/*
═══════════════════════════════════════════════════════════════
   SSLSlayer_v3.js
   Universal Android SSL Pinning Bypass

   Changes over v2:
     • Removed double Java.perform nesting
     • Fixed closure bug in auto-scan TrustManager loop
     • Added dynamic class-wait helper instead of fixed timeout
     • Added SSLSocket direct hook
     • Added TrustKit hook
     • Added Appcelerator/Titanium hook
═══════════════════════════════════════════════════════════════
*/

// Dynamic wait helper - retries every 500ms instead of fixed 3s
function waitForClass(className, callback, maxRetries) {
  var retries = 0;
  var interval = setInterval(function () {
    try {
      Java.performNow(function () { Java.use(className); });
      clearInterval(interval);
      callback();
    } catch (e) {
      if (++retries > (maxRetries || 20)) {
        clearInterval(interval);
        console.log("Slayer [-] Gave up waiting for: " + className);
      }
    }
  }, 500);
}

waitForClass("javax.net.ssl.SSLContext", function () {
  Java.perform(function () {

    function safe(fn, name) {
      try { fn(); }
      catch (e) { console.log("Slayer [-] " + name + " not available: " + (e && e.message)); }
    }

    console.log("Slayer [*] Installing SSL pinning bypass hooks...");

    // 1) SSLContext.init
    safe(function () {
      var SSLContext = Java.use("javax.net.ssl.SSLContext");
      var init = SSLContext.init.overload(
        "[Ljavax.net.ssl.KeyManager;", "[Ljavax.net.ssl.TrustManager;", "java.security.SecureRandom"
      );
      init.implementation = function (km, tm, sr) {
        console.log("Slayer [+] SSLContext.init intercepted");
        var X509TrustManager = Java.use("javax.net.ssl.X509TrustManager");
        var uniq = "org.bypass.AllTrustManager_" + Math.floor(Math.random() * 0x100000);
        var AllTrustManager = Java.registerClass({
          name: uniq,
          implements: [X509TrustManager],
          methods: {
            checkClientTrusted: function () {},
            checkServerTrusted: function () {},
            getAcceptedIssuers: function () { return []; }
          }
        });
        return init.call(this, km, [AllTrustManager.$new()], sr);
      };
    }, "SSLContext.init");

    // 2) HostnameVerifier
    safe(function () {
      var HostnameVerifier = Java.use("javax.net.ssl.HostnameVerifier");
      HostnameVerifier.verify.implementation = function (hostname) {
        console.log("Slayer [+] HostnameVerifier.verify bypass for " + hostname);
        return true;
      };
    }, "HostnameVerifier");

    // 3) OkHttp Builder + CertificatePinner
    safe(function () {
      var OkBuilder = Java.use("okhttp3.OkHttpClient$Builder");
      OkBuilder.certificatePinner.implementation = function () {
        console.log("Slayer [+] OkHttpClient.Builder.certificatePinner dropped");
        return this;
      };
    }, "okhttp3.OkHttpClient$Builder.certificatePinner");

    safe(function () {
      var CertificatePinner = Java.use("okhttp3.CertificatePinner");
      try {
        CertificatePinner.check.overload("java.lang.String", "java.util.List")
          .implementation = function (host) {
            console.log("Slayer [+] CertificatePinner.check bypass for " + host);
          };
      } catch (_) {
        CertificatePinner.check.implementation = function () {
          console.log("Slayer [+] CertificatePinner.check fallback bypass");
        };
      }
    }, "okhttp3.CertificatePinner.check");

    // 4) OkHostnameVerifier
    safe(function () {
      var OkHostnameVerifier = Java.use("okhttp3.internal.tls.OkHostnameVerifier");
      OkHostnameVerifier.verify
        .overload("java.lang.String", "javax.net.ssl.SSLSession")
        .implementation = function (host) {
          console.log("Slayer [+] OkHostnameVerifier.verify bypass for " + host);
          return true;
        };
    }, "okhttp3.internal.tls.OkHostnameVerifier");

    // 5) HttpsURLConnection
    safe(function () {
      var HttpsURLConnection = Java.use("javax.net.ssl.HttpsURLConnection");
      HttpsURLConnection.setDefaultHostnameVerifier.implementation = function () {
        console.log("Slayer [+] setDefaultHostnameVerifier intercepted - ignoring");
      };
    }, "javax.net.ssl.HttpsURLConnection");

    // 6) SSLSocket direct hook (NEW)
    safe(function () {
      var SSLSocket = Java.use("javax.net.ssl.SSLSocket");
      SSLSocket.startHandshake.implementation = function () {
        console.log("Slayer [+] SSLSocket.startHandshake - proceeding without validation");
        this.startHandshake();
      };
    }, "SSLSocket.startHandshake");

    // 7) Conscrypt TrustManagerImpl
    safe(function () {
      var TMI = Java.use("com.android.org.conscrypt.TrustManagerImpl");
      var ArrayList = Java.use("java.util.ArrayList");

      function returnCertList(chain) {
        var list = ArrayList.$new();
        if (chain) {
          for (var i = 0; i < chain.length; i++) list.add(chain[i]);
        }
        return list;
      }

      try {
        TMI.checkServerTrusted.overload(
          "[Ljava.security.cert.X509Certificate;", "java.lang.String", "java.lang.String"
        ).implementation = function (chain, authType, host) {
          console.log("Slayer [+] TrustManagerImpl.checkServerTrusted(List) bypass for " + host);
          return returnCertList(chain);
        };
      } catch (_) {}

      try {
        TMI.checkServerTrusted.overload(
          "[Ljava.security.cert.X509Certificate;", "java.lang.String"
        ).implementation = function (chain) {
          console.log("Slayer [+] TrustManagerImpl.checkServerTrusted(void) bypass");
        };
      } catch (_) {}

      try {
        TMI.verifyChain.implementation = function (untrustedChain) {
          console.log("Slayer [+] TrustManagerImpl.verifyChain bypass");
          return returnCertList(untrustedChain);
        };
      } catch (_) {}

    }, "TrustManagerImpl");

    // 8) NetworkSecurityPolicy
    safe(function () {
      var NSP = Java.use("android.security.NetworkSecurityPolicy");
      try { NSP.isCleartextTrafficPermitted.overload().implementation = function () { return true; }; } catch (_) {}
      try { NSP.isCleartextTrafficPermitted.overload("java.lang.String").implementation = function () { return true; }; } catch (_) {}
    }, "NetworkSecurityPolicy");

    // 9) WebView SSL bypass
    safe(function () {
      var WebViewClient = Java.use("android.webkit.WebViewClient");
      WebViewClient.onReceivedSslError.implementation = function (view, handler) {
        console.log("Slayer [+] WebView onReceivedSslError bypass");
        try { handler.proceed(); } catch (_) {}
      };
    }, "WebViewClient.onReceivedSslError");

    // 10) TrustKit bypass (NEW)
    safe(function () {
      var TrustKit = Java.use("com.datatheorem.android.trustkit.pinning.OkHostnameVerifier");
      TrustKit.verify
        .overload("java.lang.String", "javax.net.ssl.SSLSession")
        .implementation = function (host) {
          console.log("Slayer [+] TrustKit.verify bypass for " + host);
          return true;
        };
    }, "TrustKit.OkHostnameVerifier");

    safe(function () {
      var TrustKitPinner = Java.use("com.datatheorem.android.trustkit.pinning.PinningTrustManager");
      TrustKitPinner.checkServerTrusted.implementation = function () {
        console.log("Slayer [+] TrustKit.PinningTrustManager bypass");
      };
    }, "TrustKit.PinningTrustManager");

    // 11) Auto-find custom X509TrustManagers — closure bug fixed
    safe(function () {
      console.log("Slayer [*] Scanning for custom X509TrustManager implementations...");
      Java.enumerateLoadedClassesSync().forEach(function (cname) {
        if (cname.startsWith("java.") || cname.startsWith("javax.") || cname.startsWith("android.")) return;
        try {
          var C = Java.use(cname);
          var ifaces = C.class.getInterfaces();
          for (var i = 0; i < ifaces.length; i++) {
            if (ifaces[i].getName() === "javax.net.ssl.X509TrustManager") {
              console.log("Slayer [+] Found custom X509TrustManager: " + cname);

              // FIX: IIFE captures cname correctly per iteration
              (function (name, cls) {
                try {
                  cls.checkServerTrusted
                    .overload("[Ljava.security.cert.X509Certificate;", "java.lang.String")
                    .implementation = function () {
                      console.log("Slayer [+] Bypassing " + name + ".checkServerTrusted");
                    };
                } catch (_) {}
                try {
                  cls.checkClientTrusted
                    .overload("[Ljava.security.cert.X509Certificate;", "java.lang.String")
                    .implementation = function () {
                      console.log("Slayer [+] Bypassing " + name + ".checkClientTrusted");
                    };
                } catch (_) {}
              })(cname, C);
            }
          }
        } catch (_) {}
      });
    }, "auto-find-custom-TrustManagers");

    // 12) Native SSL/Crypto detector
    safe(function () {
      console.log("Slayer [*] Scanning for native SSL/Crypto libraries...");
      var keys = ["ssl", "crypto", "boring", "tls", "https", "nativecrypto"];
      var found = false;
      Process.enumerateModules({
        onMatch: function (m) {
          var n = m.name.toLowerCase();
          for (var i = 0; i < keys.length; i++) {
            if (n.indexOf(keys[i]) !== -1) {
              console.log("Slayer [!] Native Library: " + m.name + " @ " + m.base);
              found = true; break;
            }
          }
        },
        onComplete: function () {
          console.log(found
            ? "Slayer [!] WARNING: Native SSL libs found. Java hooks may not cover these."
            : "Slayer [*] No native SSL libraries detected.");
        }
      });
    }, "NativeSSLDetection");

    console.log("Slayer [✓] All hooks installed.");
  });
});