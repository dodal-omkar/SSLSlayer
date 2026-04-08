# SSLSlayer - Universal Android SSL Pinning Bypass

A Frida-based script for bypassing SSL pinning during authorized 
Android application security assessments.

## Coverage
- SSLContext / TrustManager
- HostnameVerifier
- OkHttp (CertificatePinner, Builder, OkHostnameVerifier)
- Conscrypt TrustManagerImpl
- NetworkSecurityPolicy
- WebView SSL errors
- TrustKit
- SSLSocket direct
- Custom X509TrustManager auto-scan
- Native SSL/Crypto library detection


## Usage
frida -U -f com.target.app -l SSLSlayer_v3.js
frida -H 127.0.0.1:PORT -f com.target.app -l SSLSlayer_v3.js

## Legal Disclaimer
This tool is intended for authorized security testing only.
Only use against applications you have explicit written permission
to test. The author is not responsible for misuse.
