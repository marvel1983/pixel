/**
 * Seeds product_seo_content for the /buy/:slug programmatic landing pages.
 *
 *   pnpm --filter @workspace/scripts seed:buy            # write
 *   pnpm --filter @workspace/scripts seed:buy -- --dry   # preview 3
 *
 * Content is generated with product-archetype judgment (OEM vs Retail vs
 * Office vs 365 vs Server vs Antivirus …) so every page is materially
 * different — not a string-swapped template (which Google deindexes as
 * scaled-content abuse). Idempotent upsert per product.
 */
import { db, pool } from "@workspace/db";
import { productSeoContent } from "@workspace/db/schema";
import { sql } from "drizzle-orm";

const DRY = process.argv.includes("--dry");

// Top 50 by units sold (Pixel prod, snapshot). [id, slug, name]
const PRODUCTS: [number, string, string][] = [
  [799, "microsoft-windows-11-pro-retail-6a26fc", "Microsoft Windows 11 Pro Retail"],
  [39, "microsoft-office-2024-professional-plus", "Microsoft Office 2024 Professional Plus"],
  [46, "microsoft-office-pro-plus-2021-retail-phone-activation", "Microsoft Office Pro Plus 2021 Retail – Phone Activation"],
  [45, "microsoft-windows-11-pro-oem-key", "Microsoft Windows 11 Pro Oem Key"],
  [186, "microsoft-office-365-personal-eu-1-year", "Microsoft Office 365 Personal EU 1 Year"],
  [182, "microsoft-windows-11-pro-full-retail", "Microsoft Windows 11 Pro Full Retail"],
  [265, "microsoft-office-2024-professional-plus-phone-activation", "Microsoft Office 2024 Professional Plus | Phone Activation"],
  [35, "microsoft-windows-10-pro-retail-key", "Microsoft Windows 10 Pro Retail KEY"],
  [192, "microsoft-office-pro-plus-2019-retail-online-activation", "Microsoft Office Pro Plus 2019 Retail – Online activation"],
  [319, "microsoft-windows-11-pro-n-retail-key", "Microsoft Windows 11 Pro N - Retail key"],
  [275, "cid-activation", "Cid Activation"],
  [278, "microsoft-office-pro-plus-2019-retail-phone-activation", "Microsoft Office Pro Plus 2019 Retail – Phone activation"],
  [181, "microsoft-windows-11-home-retail-key", "Microsoft Windows 11 Home Retail Key"],
  [373, "microsoft-windows-10-home-retail-key", "Microsoft Windows 10 Home Retail KEY"],
  [252, "microsoft-office-home-and-business-2021-retail-mac-only-bind", "Microsoft Office Home and Business 2021 Retail MAC only – BIND"],
  [272, "microsoft-office-pro-plus-2016-online-activation", "Microsoft Office Pro Plus 2016 – Online activation"],
  [294, "microsoft-windows-server-2025-standard", "Microsoft Windows Server 2025 Standard"],
  [178, "microsoft-windows-10-pro-oem-key", "Microsoft Windows 10 Pro Oem Key"],
  [232, "microsoft-windows-10-pro-n-retail", "Microsoft Windows 10 Pro N Retail"],
  [419, "mcafee-total-protection-5-devices-2-years-global", "McAfee Total Protection - 5 Devices / 2 Years, Global"],
  [405, "microsoft-office-home-business-2019-retail-phone-activation", "Microsoft Office Home Business 2019 Retail – Phone Activation"],
  [109, "microsoft-windows-11-iot-enterprise-ltsc-2024", "Microsoft Windows 11 IoT Enterprise LTSC 2024"],
  [177, "microsoft-office-pro-plus-2016-phone-activation", "Microsoft Office Pro Plus 2016 – Phone activation"],
  [219, "microsoft-windows-11-home-full-retail", "Microsoft Windows 11 Home Full Retail"],
  [400, "microsoft-office-pro-plus-2019-retail-binds-to-ms-account", "Microsoft Office Pro Plus 2019 Retail – BINDS to MS account"],
  [152, "microsoft-windows-11-pro-full-oem", "Microsoft Windows 11 Pro FULL OEM"],
  [388, "microsoft-office-365-family-eu-1-year", "Microsoft Office 365 Family EU 1 Year"],
  [257, "microsoft-windows-server-standard-2019", "Microsoft Windows Server Standard 2019"],
  [176, "kaspersky-plus-1-device-1-year-eu", "Kaspersky Plus - 1 device / 1 year EU"],
  [229, "microsoft-windows-server-2025-datacenter", "Microsoft Windows Server 2025 Datacenter"],
  [147, "kaspersky-plus-3-devices-1-year-eu", "Kaspersky Plus - 3 devices / 1 year EU"],
  [302, "kaspersky-standard-1-device-1-year-eu", "Kaspersky Standard - 1 Device | 1 Year | EU"],
  [134, "mcafee-internet-security-10-devices-1-year", "McAfee Internet Security 10 Devices 1 Year"],
  [144, "microsoft-windows-11-enterprise", "Microsoft Windows 11 Enterprise"],
  [321, "microsoft-windows-server-2022-standard", "Microsoft Windows Server 2022 Standard"],
  [398, "avg-ultimate-10-multi-devices-vpn-3-years-global", "AVG Ultimate 10-Multi Devices VPN 3-Years, Global"],
  [368, "mcafee-total-protection-2022-5-devices-1-year-global", "McAfee Total Protection 2022 - 5 Devices / 1 Year, Global"],
  [43, "microsoft-office-pro-plus-2016-bind", "Microsoft Office Pro Plus 2016 – BIND"],
  [155, "kaspersky-standard-3-devices-1-year-eu", "Kaspersky Standard - 3 Devices | 1 Year | EU"],
  [131, "microsoft-office-home-and-business-2019-mac-binds-to-ms-account", "Microsoft Office Home and Business 2019 MAC – BINDS to MS account"],
  [38, "microsoft-word-2024-bind", "Microsoft Word 2024 BIND"],
  [143, "microsoft-windows-11-pro-volume-key-20-users", "Microsoft Windows 11 Pro Volume key (20 users)"],
  [299, "microsoft-project-2024-pro-bind", "Microsoft Project 2024 Pro - BIND"],
  [220, "microsoft-excel-2024-bind", "Microsoft Excel 2024 BIND"],
  [878, "mcafee-internet-security-1-user-1-year-global-d31a9a", "McAfee Internet Security  - 1 User 1 Year, Global"],
  [323, "ashampoo-pdf-pro-5-1-pc-esd", "Ashampoo PDF Pro 5 / 1-PC (ESD)"],
  [375, "microsoft-office-home-2024-pc-non-bind-retail", "Microsoft Office Home 2024 PC (non BIND) - Retail"],
  [59, "kaspersky-plus-3-devices-2-years-eu", "Kaspersky Plus | 3 Devices | 2 Years | EU"],
  [44, "microsoft-office-pro-plus-2021-retail-bind", "Microsoft Office Pro Plus 2021 Retail – BIND"],
  [235, "bitdefender-antivirus-plus-3-pc-1-year-eu-only-read-description", "Bitdefender Antivirus Plus (3 PC -1 Year), EU only (read description)"],
];

interface Gen { intro: string; whyBuy: string[]; faq: { q: string; a: string }[]; activationSteps: string[] }

function classify(name: string) {
  const n = name.toLowerCase();
  return {
    isWindows: /windows/.test(n),
    isOffice: /office|word|excel|project/.test(n),
    isServer: /server/.test(n),
    is365: /365/.test(n),
    isOem: /\boem\b/.test(n),
    isRetail: /retail/.test(n),
    isN: /\bn\b.*retail|\bn -|\bn key|pro n/.test(n),
    isHome: /home/.test(n) && !/home.*business/.test(n),
    isHomeBiz: /home.*business/.test(n),
    isEnterprise: /enterprise|iot|ltsc|volume/.test(n),
    isMac: /mac/.test(n),
    bind: /\bbind/.test(n),
    phone: /phone activation/.test(n),
    online: /online activation/.test(n),
    antivirus: /kaspersky|mcafee|avg|bitdefender/.test(n),
    vpn: /vpn/.test(n),
    pdf: /pdf|ashampoo/.test(n),
    cid: /\bcid\b/.test(n),
    win11: /windows 11/.test(n),
    win10: /windows 10/.test(n),
  };
}

function generate(name: string): Gen {
  const c = classify(name);
  const whyBuy: string[] = [
    "Instant email delivery — your key arrives within minutes of payment, any time of day.",
    "Genuine licence sourced through authorised channels, not grey-market resale.",
  ];
  const faq: { q: string; a: string }[] = [];
  let intro = "";
  const steps: string[] = [];

  if (c.isWindows && !c.isServer) {
    const ver = c.win11 ? "Windows 11" : c.win10 ? "Windows 10" : "Windows";
    const edition = c.isHome ? "Home" : c.isEnterprise ? (/iot|ltsc/.test(name.toLowerCase()) ? "IoT Enterprise LTSC" : "Enterprise") : "Pro";
    intro = `${name} unlocks the full ${ver} ${edition} feature set — ${edition === "Pro" ? "BitLocker drive encryption, Remote Desktop host, Hyper-V and group-policy management" : edition === "Home" ? "a fast, secure desktop for everyday computing, gaming and productivity" : "long-term-servicing stability for fixed-function and business devices"}. ${c.isOem ? "This OEM licence is the budget route: it ties to the first PC it activates on." : c.isRetail ? "This retail licence is transferable — move it to a new PC whenever you upgrade hardware." : "Activate online in minutes and keep the licence for the lifetime of the device."} Delivered as a digital key by email, no disc, no waiting.`;
    whyBuy.push(c.isOem ? "OEM pricing — the cheapest legitimate way onto genuine Windows." : "Retail licence — re-usable on a new PC after a hardware change.");
    whyBuy.push("Lifetime activation — no subscription, no recurring fee.");
    if (c.isN) whyBuy.push("‘N’ edition: identical to the standard edition minus the bundled media apps (Media Player), required in some EU procurement.");
    steps.push("Open Settings → System → Activation.", "Choose ‘Change product key’ and paste the key from your email.", "Click Next — activation completes online in seconds.");
    faq.push(
      { q: `Is this ${ver} key genuine?`, a: `Yes. It activates directly with Microsoft's servers and reports as genuine in Settings → Activation. ${c.isOem ? "It is an OEM licence — fully genuine, bound to one device." : "It is a retail licence and can be moved to another PC."}` },
      { q: c.isOem ? "Can I move this OEM key to a new PC later?" : "Can I transfer this key to a new computer?", a: c.isOem ? "No — OEM licences stay with the first machine they activate on. If you change motherboards or PCs you will need a new key. Choose a retail edition if you want transfer rights." : "Yes. Deactivate it on the old PC (or simply stop using it), then enter the same key on the new machine and re-activate online." },
      { q: `Do I need to reinstall ${ver} to use this key?`, a: `No. If ${ver} is already installed you only need to enter the key in Settings → Activation. A clean install is optional.` },
      { q: "When do I receive the key?", a: "Immediately after checkout — the key is emailed automatically, typically within a couple of minutes." },
    );
  } else if (c.isServer) {
    const sv = /2025/.test(name) ? "2025" : /2022/.test(name) ? "2022" : /2019/.test(name) ? "2019" : "";
    const tier = /datacenter/i.test(name) ? "Datacenter" : "Standard";
    intro = `${name} is a genuine Windows Server ${sv} ${tier} licence for production workloads — ${tier === "Datacenter" ? "unlimited virtualised instances, Storage Spaces Direct and Software-Defined Networking" : "core file, print, AD DS, IIS and up to two Hyper-V VMs"}. Delivered instantly by email so you can stand up or re-license a server the same day.`;
    whyBuy.push(`${tier} edition — ${tier === "Datacenter" ? "unlimited VM rights for dense virtualisation hosts." : "right-sized for most line-of-business and infrastructure roles."}`);
    whyBuy.push("Permanent licence — no annual renewal.");
    steps.push("Run installation or open an elevated command prompt.", "Use slmgr /ipk <key> then slmgr /ato, or enter the key during Setup.", "Confirm activation with slmgr /xpr.");
    faq.push(
      { q: `Does this include Client Access Licences (CALs)?`, a: "No. The server licence covers the operating system itself. User or device CALs are purchased separately based on how many clients connect — this is standard Microsoft licensing for every reseller." },
      { q: `Is Server ${sv} ${tier} genuine and activatable?`, a: "Yes — it activates against Microsoft's servers and is suitable for production use." },
      { q: "Physical or virtual — where can I use it?", a: tier === "Datacenter" ? "Both, with unlimited virtual instances on the licensed host." : "Physical install plus up to two Hyper-V virtual machines on the same licensed host." },
      { q: "How fast is delivery?", a: "Instant — the key is emailed within minutes of payment." },
    );
  } else if (c.is365) {
    const plan = /family/i.test(name) ? "Family (up to 6 people)" : "Personal (1 person)";
    intro = `${name} is a 1-year Microsoft 365 ${plan} subscription — always-updated Word, Excel, PowerPoint and Outlook, 1 TB OneDrive per user and premium features across PC, Mac, tablet and phone. The subscription code is delivered by email and redeemed on your Microsoft account in minutes.`;
    whyBuy.push(`365 ${plan} — full desktop apps plus 1 TB cloud storage.`);
    whyBuy.push("Always the latest version — feature and security updates included for the term.");
    steps.push("Sign in at account.microsoft.com/redeem.", "Enter the 25-character code from your email.", "Install Microsoft 365 from office.com — apps activate automatically.");
    faq.push(
      { q: "Is this a subscription or a one-time licence?", a: `It is a 1-year ${/family/i.test(name) ? "Microsoft 365 Family" : "Microsoft 365 Personal"} subscription. After 12 months you can renew with another code or let it lapse — your files stay, the apps switch to read-only until renewed.` },
      { q: "Does it work on Mac and mobile?", a: "Yes — Microsoft 365 covers Windows, macOS, iOS and Android with the same subscription." },
      { q: "Can I stack it onto an existing 365 subscription?", a: "Yes. Redeeming the code on an account with active 365 extends the existing expiry date." },
      { q: "When is the code delivered?", a: "Within minutes of payment, by email." },
    );
  } else if (c.isOffice) {
    const yr = (name.match(/20\d\d/) || [""])[0];
    const app = /word/i.test(name) ? "Word" : /excel/i.test(name) ? "Excel" : /project/i.test(name) ? "Project" : /home.*business/i.test(name) ? "Office Home & Business" : /home 2024|home 20\d\d/i.test(name) ? "Office Home" : "Office Professional Plus";
    intro = `${name} is a one-time-purchase ${app} ${yr} licence — own it outright, no subscription. ${app.includes("Professional Plus") ? "Includes Word, Excel, PowerPoint, Outlook, Access and Publisher." : app === "Office Home & Business" ? "Includes Word, Excel, PowerPoint and Outlook for home and commercial use." : `The full desktop ${app} application.`} ${c.bind ? "This licence binds to your Microsoft account, so reinstalls are one-click from office.com." : c.phone ? "Activation is by phone if the automatic online step is unavailable in your region — a quick guided call." : "Activated online in minutes."} Delivered instantly by email.`;
    whyBuy.push("One-time purchase — no monthly fee, yours permanently.");
    whyBuy.push(c.bind ? "Binds to your Microsoft account — reinstall any time without a new key." : c.phone ? "Phone-activation guide included; works even where online activation is blocked." : "Instant online activation.");
    if (c.isMac) whyBuy.push("macOS compatible — installs and activates on Mac.");
    steps.push(c.bind ? "Sign in at setup.office.com with your Microsoft account." : "Download Office from the official Microsoft link in your email.", "Enter the product key from your email.", c.phone ? "If prompted, complete the short phone-activation wizard (steps included)." : "Activation completes online — open any app to confirm.");
    faq.push(
      { q: `Is ${app} ${yr} a subscription?`, a: "No — this is a perpetual (one-time) licence. You own this version permanently; there is no renewal." },
      { q: c.bind ? "What does ‘BIND to Microsoft account’ mean?" : c.phone ? "Why phone activation?" : "How is it activated?", a: c.bind ? "The licence attaches to your Microsoft account. Reinstalls and new PCs just need you to sign in — no key re-entry." : c.phone ? "If Microsoft's automatic online activation isn't offered for your key/region, a free automated phone call completes it in a minute. Full steps are in the email." : "Online, in a couple of minutes, via the product key — no phone call needed." },
      { q: "Will it conflict with an existing Office install?", a: "Uninstall any trial or older Office first for a clean activation, then install this edition. Your documents are never affected." },
      { q: "How quickly is the key delivered?", a: "Automatically by email within minutes of purchase." },
    );
  } else if (c.antivirus) {
    const brand = /kaspersky/i.test(name) ? "Kaspersky" : /mcafee/i.test(name) ? "McAfee" : /avg/i.test(name) ? "AVG" : "Bitdefender";
    const dev = (name.match(/(\d+)\s*(?:device|pc|user)/i) || [, "the licensed number of"])[1];
    const yrs = (name.match(/(\d+)\s*year/i) || [, "1"])[1];
    intro = `${name} is a genuine ${brand} subscription protecting ${dev} device(s) for ${yrs} year(s) — real-time malware, ransomware and phishing defence${c.vpn ? ", plus an unlimited VPN" : ""}. The activation code is emailed instantly so protection can be live within minutes.`;
    whyBuy.push(`Covers ${dev} device(s) for ${yrs} year(s) on Windows, Mac, Android and iOS.`);
    whyBuy.push(`Latest ${brand} engine with automatic definition updates for the full term.`);
    if (c.vpn) whyBuy.push("Bundled VPN for private, unthrottled browsing.");
    steps.push(`Download ${brand} from the official site.`, "Create or sign in to your account and enter the activation code from your email.", "Protection activates immediately — run a first scan.");
    faq.push(
      { q: `Is this ${brand} licence genuine?`, a: `Yes — it activates on ${brand}'s official servers with full updates for the entire term.` },
      { q: "Can I split the licence across different devices?", a: `Yes — the ${dev}-device allowance can be mixed across Windows, Mac and mobile in any combination.` },
      { q: "Does it auto-renew and charge me later?", a: "No. This is a fixed-term code with no stored payment — it simply expires at the end of the term unless you buy another." },
      { q: "When does it arrive?", a: "Within minutes of checkout, by email." },
    );
  } else {
    intro = `${name} — a genuine licence delivered instantly by email. Pay once, receive your key within minutes, and activate without subscriptions or hidden fees.`;
    whyBuy.push("Straightforward one-time licence with clear activation instructions in your email.");
    steps.push("Open the product and choose to enter a licence/product key.", "Paste the key from your delivery email.", "Confirm — activation completes in seconds.");
    faq.push(
      { q: "Is the licence genuine?", a: "Yes — sourced through authorised channels and activatable with the vendor." },
      { q: "How fast is delivery?", a: "Instant — emailed automatically within minutes of payment." },
      { q: "Is there a subscription?", a: "No — this is a one-time purchase." },
    );
  }

  whyBuy.push("Encrypted checkout and 24/7 human support if activation ever needs a hand.");
  return { intro, whyBuy, faq, activationSteps: steps };
}

async function main() {
  let n = 0;
  for (const [productId, , name] of PRODUCTS) {
    const g = generate(name);
    if (DRY) {
      if (n < 3) console.log(`\n# ${name}\nINTRO: ${g.intro}\nWHY: ${g.whyBuy.join(" | ")}\nFAQ: ${g.faq.map((f) => f.q).join(" / ")}\nSTEPS: ${g.activationSteps.join(" ")}`);
      n++;
      continue;
    }
    await db
      .insert(productSeoContent)
      .values({ productId, intro: g.intro, whyBuy: g.whyBuy, faq: g.faq, activationSteps: g.activationSteps })
      .onConflictDoUpdate({
        target: productSeoContent.productId,
        set: { intro: g.intro, whyBuy: g.whyBuy, faq: g.faq, activationSteps: g.activationSteps, updatedAt: new Date() },
      });
    n++;
  }
  console.log(DRY ? "Dry run — previewed 3." : `Seeded ${n} product_seo_content rows.`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
