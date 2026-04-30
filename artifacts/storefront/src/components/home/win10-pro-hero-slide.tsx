import { Link } from "wouter";
import "./win10-pro-hero-slide.css";

const PRODUCT_HREF = "/product/microsoft-windows-10-pro-retail-key";

export function Win10ProHeroSlide() {
  return (
    <section className="win10-pro-hero-shell" aria-label="Windows 10 Pro Retail hero banner">
      {/* Decorative tech lines */}
      <div className="tech-lines" aria-hidden="true">
        <svg viewBox="0 0 1920 740" preserveAspectRatio="xMidYMid slice" role="img">
          <defs>
            <linearGradient id="win10-pro-line" x1="0" x2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
              <stop offset=".45" stopColor="#0078d4" stopOpacity=".35" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M900 120 C1080 60 1220 84 1390 150 S1690 245 1870 120" fill="none" stroke="url(#win10-pro-line)" strokeWidth="2" />
          <path d="M760 510 C1040 430 1220 520 1440 450 S1710 330 1930 395" fill="none" stroke="url(#win10-pro-line)" strokeWidth="2" />
          <path d="M1030 190 L1150 245 L1285 222 L1435 315 L1655 275 L1815 350" fill="none" stroke="#0078d4" strokeOpacity=".18" strokeWidth="2" />
          <circle cx="1030" cy="190" r="5" fill="#0078d4" opacity=".28" />
          <circle cx="1285" cy="222" r="5" fill="#0078d4" opacity=".28" />
          <circle cx="1655" cy="275" r="5" fill="#0078d4" opacity=".28" />
          <g opacity=".28" stroke="#0078d4" strokeWidth="2" fill="none">
            <rect x="1470" y="145" width="150" height="92" rx="16" />
            <path d="M1515 190h60M1545 160v60" />
            <rect x="1585" y="392" width="138" height="92" rx="16" />
            <path d="M1625 448h58M1654 413v70" />
          </g>
        </svg>
      </div>

      <div className="hero">
        {/* PART 1: Main message */}
        <div className="part left">
          <div className="brand" aria-label="Microsoft">
            <span className="ms-grid" aria-hidden="true"><span /><span /><span /><span /></span>
            <span>Microsoft</span>
          </div>
          <h1>Windows <span>10</span> Pro</h1>
          <div className="accent-line" aria-hidden="true" />
          <div className="message">
            <strong>Trusted. Stable. Yours forever.</strong>
            <p>Windows 10 Pro Retail key with instant digital delivery, secure activation and lifetime use on your device.</p>
          </div>
        </div>

        {/* PART 2: Benefits + sale CTA */}
        <div className="part middle">
          <div className="benefits">
            <div className="benefit">
              <div className="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 12L13 4l-1 7-7 1 8 8 8-8z" /><path d="M5 12h7" /></svg>
              </div>
              <div><b>Instant Delivery</b><small>Receive your key by email in minutes.</small></div>
            </div>
            <div className="benefit">
              <div className="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 2a10 10 0 0 0-10 10 10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2z" /><path d="M12 6v6l4 2" /></svg>
              </div>
              <div><b>24/7 Support</b><small>Real humans whenever you need help.</small></div>
            </div>
            <div className="benefit">
              <div className="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-5" /></svg>
              </div>
              <div><b>Genuine Key</b><small>One-time payment, lifetime activation.</small></div>
            </div>
          </div>

          <div className="sale-card">
            <span className="sale-ribbon">Limited time sale</span>
            <div className="price-row">
              <div className="price" aria-label="Only 9.90 euro">
                <span className="currency">€</span><span className="amount">9.90</span>
              </div>
              <div className="divider" aria-hidden="true" />
              <div className="delivery">
                <strong>Instant Delivery</strong>
                <span>Receive your activation key by email after purchase.</span>
              </div>
            </div>
            <Link href={PRODUCT_HREF} className="cta">
              <span>
                <b>Get your key now</b>
                <span className="cta-sub">Windows 10 Pro Retail · Digital license</span>
              </span>
              <span className="arrow" aria-hidden="true">›</span>
            </Link>
          </div>
        </div>

        {/* PART 3: 3D product box */}
        <div className="part product-stage">
          <div className="glow-disc" aria-hidden="true" />
          <div className="product-box-wrap" aria-label="3D Windows 10 Pro Retail product box">
            <div className="box-side"><div className="side-text">Windows 10 Pro</div></div>
            <div className="box-front">
              <div className="box-brand">
                <span className="ms-grid" aria-hidden="true"><span /><span /><span /><span /></span>
                <span>Microsoft</span>
              </div>
              <div className="box-title">Windows 10 <span>Pro</span></div>
              <div className="windows-mark" aria-hidden="true"><i /><i /><i /><i /></div>
              <div className="box-tag">Trusted. Stable. Built to Last.</div>
            </div>
            <div className="badge">
              <div>
                <span className="badge-num">100%</span>
                <span className="badge-sub">GENUINE<br />RETAIL KEY</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
