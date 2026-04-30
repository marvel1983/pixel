import { Link } from "wouter";
import "./win-pro-hero-slide.css";

const PRODUCT_HREF = "/product/microsoft-windows-11-pro-retail-key";

export function WinProHeroSlide() {
  return (
    <section className="win-pro-hero-shell" aria-label="Windows 11 Pro Retail hero banner">
      {/* Decorative tech lines (background) */}
      <div className="tech-lines" aria-hidden="true">
        <svg viewBox="0 0 1920 740" preserveAspectRatio="xMidYMid slice" role="img">
          <defs>
            <linearGradient id="win-pro-line" x1="0" x2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
              <stop offset=".45" stopColor="#1464f6" stopOpacity=".35" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M900 120 C1080 60 1220 84 1390 150 S1690 245 1870 120" fill="none" stroke="url(#win-pro-line)" strokeWidth="2" />
          <path d="M760 510 C1040 430 1220 520 1440 450 S1710 330 1930 395" fill="none" stroke="url(#win-pro-line)" strokeWidth="2" />
          <path d="M1030 190 L1150 245 L1285 222 L1435 315 L1655 275 L1815 350" fill="none" stroke="#1464f6" strokeOpacity=".18" strokeWidth="2" />
          <circle cx="1030" cy="190" r="5" fill="#1464f6" opacity=".28" />
          <circle cx="1285" cy="222" r="5" fill="#1464f6" opacity=".28" />
          <circle cx="1655" cy="275" r="5" fill="#1464f6" opacity=".28" />
          <g opacity=".28" stroke="#1464f6" strokeWidth="2" fill="none">
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
          <h1>Windows 11 <span>Pro</span></h1>
          <div className="accent-line" aria-hidden="true" />
          <div className="message">
            <strong>Upgrade today. Work faster tomorrow.</strong>
            <p>Windows 11 Pro Retail key with instant digital delivery, secure activation and lifetime use on your device.</p>
          </div>
        </div>

        {/* PART 2: Benefits + sale CTA */}
        <div className="part middle">
          <div className="benefits">
            <div className="benefit">
              <div className="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-5" /></svg>
              </div>
              <div><b>Genuine Retail Key</b><small>One-time payment, lifetime activation.</small></div>
            </div>
            <div className="benefit">
              <div className="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 13a8 8 0 1 1 16 0" /><path d="M12 13l5-5" /><path d="M5 19h14" /></svg>
              </div>
              <div><b>Built for Speed</b><small>Better productivity and daily performance.</small></div>
            </div>
            <div className="benefit">
              <div className="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="4" width="14" height="11" rx="2" /><path d="M8 20h8M12 15v5" /><rect x="17" y="9" width="4" height="8" rx="1" /></svg>
              </div>
              <div><b>Wide Compatibility</b><small>Works with most Windows 11 devices.</small></div>
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
                <span className="cta-sub">Windows 11 Pro Retail · Digital license</span>
              </span>
              <span className="arrow" aria-hidden="true">›</span>
            </Link>
          </div>
        </div>

        {/* PART 3: 3D product box */}
        <div className="part product-stage">
          <div className="glow-disc" aria-hidden="true" />
          <div className="product-box-wrap" aria-label="3D Windows 11 Pro Retail product box">
            <div className="box-side"><div className="side-text">Windows 11 Pro</div></div>
            <div className="box-front">
              <div className="box-brand">
                <span className="ms-grid" aria-hidden="true"><span /><span /><span /><span /></span>
                <span>Microsoft</span>
              </div>
              <div className="box-title">Windows 11 <span>Pro</span></div>
              <div className="windows-mark" aria-hidden="true"><i /><i /><i /><i /></div>
              <div className="box-tag">For Work. For Play. For Everything.</div>
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
