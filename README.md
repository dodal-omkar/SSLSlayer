# SSLSlayer 🔐⚔️

A Frida-based script to bypass SSL pinning in Android applications during security assessments.  
Built to handle real-world implementations across framework, library, and custom trust validation layers.

---

> ⚠️ **Legal Disclaimer**  
> This tool is intended for **authorized security testing only**.  
> Do not use against applications without explicit written permission.  
> The author is not responsible for misuse.

---

## The Problem

Modern Android apps enforce SSL pinning to prevent:
- MITM interception
- Proxy-based traffic inspection
- Runtime analysis of HTTPS communication

Typical behavior:
SSL validation → Pin mismatch → Connection blocked

This blocks visibility into API traffic, even in controlled testing environments.

---

## The Approach

Instead of modifying the APK or patching certificates, `SSLSlayer` hooks SSL validation logic at runtime using Frida.  

---

## Coverage

### Framework-Level Hooks
- `SSLContext.init` (TrustManager injection)
- `HostnameVerifier`
- `HttpsURLConnection`
- `NetworkSecurityPolicy`
- `WebViewClient.onReceivedSslError`

### Library Support
- **OkHttp** — `CertificatePinner`, `OkHostnameVerifier`, Builder overrides
- **Conscrypt** — `TrustManagerImpl.checkServerTrusted`, `verifyChain`
- **TrustKit** — `OkHostnameVerifier`, `PinningTrustManager`

### Advanced Coverage
- Direct `SSLSocket` usage
- Custom `X509TrustManager` auto-detection
- Dynamic class loading handling
- Native SSL library detection (warning mode)

---

## Features

- Dynamic class wait (no fixed delays)
- Safe hook installation (no crash on missing classes)
- Automatic detection of custom trust managers
- Broad compatibility across Android versions
- Runtime logging for analysis

---

## Usage

**Spawn and hook (recommended)**
```bash
frida -U -f com.target.app -l SSLSlayer_v3.js
```

**Remote Frida server**
```bash
frida -H 127.0.0.1:PORT -f com.target.app -l SSLSlayer_v3.js
```

---

---

## Limitations

- Advanced native pinning (BoringSSL/OpenSSL) may require additional native hooks
- Anti-Frida protections can interfere with execution
- Some heavily obfuscated apps may need manual class name adjustments

---
