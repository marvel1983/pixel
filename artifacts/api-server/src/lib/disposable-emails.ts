/**
 * Static blocklist of known disposable / temporary email providers.
 * These domains are heavily used for fraud and throwaway registrations.
 */
const DISPOSABLE_DOMAINS = new Set([
  // Mailinator family
  "mailinator.com","mailinator2.com","mailinator.net","mailinator.org",
  // Guerrilla Mail
  "guerrillamail.com","guerrillamail.net","guerrillamail.org","guerrillamail.biz",
  "guerrillamail.de","guerrillamail.info","grr.la","spam4.me",
  "sharklasers.com","guerrillamailblock.com","yopmail.fr","cool.fr.nf",
  "jetable.fr.nf","nospam.ze.tc","nomail.xl.cx","mega.zik.dj","speed.1s.fr",
  // Trash Mail
  "trashmail.com","trashmail.at","trashmail.io","trashmail.me","trashmail.net",
  "trashmail.org","trashmail.fr","trashmail.xyz",
  // Temp Mail
  "temp-mail.org","tempmail.com","tempmail.net","tempmail.de","tempmail.io",
  "temp-mail.com","temp-mail.io","tempr.email","tmpmail.org","tmpmail.net",
  // 10 Minute Mail
  "10minutemail.com","10minutemail.net","10minutemail.org","10minutemail.co.uk",
  "10minutemail.de","10minutemail.nl","10minutemail.us","10minemail.com",
  "20minutemail.com","30minutemail.com",
  // Yop Mail
  "yopmail.com","yopmail.net","yopmail.org","cool.fr.nf","jetable.fr.nf",
  // Throwaway
  "throwam.com","throwaway.email","throwam.net","throwawaymailaddress.com",
  // Discard
  "discard.email","discardmail.com","discardmail.de",
  // Fakeinbox / Fake
  "fakeinbox.com","fakeemail.com","fake-email.com",
  // Spam
  "spamgourmet.com","spamgourmet.net","spamgourmet.org","spambox.us",
  "spamfree24.org","spam.la","spamoff.de","spaml.de","spaml.com",
  // Maildrop / Mailnull / Mailnesia
  "maildrop.cc","mailnull.com","mailnesia.com","mailcatch.com","mailexpire.com",
  "mail-temp.com","mailforspam.com","mailin8r.com","mailscrap.com",
  // Jetable (French)
  "jetable.org","jetable.net","jetable.pp.ua",
  // Dispostable
  "dispostable.com","disposableaddress.com","disposableemailaddresses.com",
  "disposablemails.com",
  // Sogetthis / Nowmymail
  "sogetthis.com","nowmymail.com","nomail.pw","noclickemail.com",
  // Email on deck
  "emailondeck.com","emailtemporal.org","emailthe.net","emailtmp.com",
  // Burner
  "burnermail.io","burnermailz.com",
  // Inbox Alias / Temp Inbox
  "tempinbox.com","tempinbox.co.uk","tempemail.com","tempemail.net",
  "tempemail.co.uk","tempemail.biz","tempemail.info",
  // GuerrillaMail aliases
  "amilegit.com","getairmail.com","filzmail.com","spamgob.com",
  // 0-mail
  "0-mail.com","0815.ru","0clickemail.com",
  // Misc popular disposables
  "nospamfor.us","no-spam.ws","nobulk.com","nospam.ze.tc",
  "mytrashmail.com","mt2009.com","mt2014.com","mt2015.com",
  "deadaddress.com","dump-email.info","dumpandforfeit.com",
  "dumpmail.de","fakemail.net","fakemail.fr","fakemail.io",
  "fakemailgenerator.com","fakemailz.com","filzmail.de",
  "frapmail.com","freemail.ms","freundin.ru",
  "gishpuppy.com","givmail.com","harakirimail.com",
  "hushmail.de","hulapla.de","iheartspam.org",
  "incognitomail.com","incognitomail.net","incognitomail.org",
  "infocom.zp.ua","instant-mail.de","instantmail.fr",
  "internet-e-mail.de","internet-emails.de",
  "keepmymail.com","killmail.com","killmail.net",
  "kir.ch.tc","klassmaster.com","klassmaster.net",
  "kurzepost.de","letthemeatspam.com","liveradio.tk",
  "loadby.us","lopl.co.cc","lr78.com",
  "lukop.dk","mail.mezimages.net","mailbucket.org",
  "mailfall.com","mailfreeonline.com","mailguard.me",
  "mailimate.com","mailme.ir","mailme.lv","mailme24.com",
  "mailmetrash.com","mailmoat.com","mailnew.com",
  "mailseal.de","mailzilla.com","mailzilla.org",
  "mbx.cc","mega.zik.dj","meltmail.com",
  "mierdamail.com","mintemail.com","misterpinball.de",
  "moncourrier.fr.nf","monemail.fr.nf","monmail.fr.nf",
  "mswork.ru","mx0.wwwnew.eu","mycleaninbox.net",
  "myphantomemail.com","netzidiot.de","nexi.yt",
  "nnot.net","no-spam.hu","noblepioneer.com",
  "nospam4.us","nospam.tonight.dns2.us","notmail.com",
  "nowmymail.net","nowmymail.org","objectmail.com",
  "obobbo.com","odnorazovoe.ru","oneoffemail.com",
  "oneoffmail.com","onewaymail.com","online.ms",
  "onqin.com","oopi.org","ordinaryamerican.net",
  "owlpic.com","pancakemail.com","pjjkp.com",
  "plexolan.de","pm.me","poofy.org","pookmail.com",
  "pop3.xyz","postinbox.com","postpro.net","proxymail.eu",
  "prtnx.com","punkass.com","putthisinyourspamdatabase.com",
  "qq.com","quickmail.nl","rcpt.at",
  "recode.me","recursor.net","recyclemail.dk",
  "regbypass.comsafe-mail.net","rejectmail.com",
  "reqn.de","rklips.com","rppkn.com","rtrtr.com",
  "s0ny.net","safe-mail.net","safetymail.info","safetypost.de",
  "sandelf.de","schafmail.de","secure-box.net","selfdestructingmail.com",
  "sendspamhere.com","sharedmailbox.org","shiftmail.com",
  "shortmail.net","silent.li","sinaite.net",
  "sinnlos-mail.de","siteposter.net","slopsbox.com",
  "slushmail.com","smashmail.de","sneakemail.com",
  "sofimail.com","sofort-mail.de","spam-be-gone.com",
  "spamavert.com","spambob.com","spambob.net","spambob.org",
  "spamex.com","spamfree.eu","spamhere.net",
  "spamhole.com","spamify.com","spaminator.de",
  "spamkill.info","spammotel.com","spamnot.com",
  "spamout.de","spamslicer.com","spamspot.com",
  "spamstack.net","spamthis.co.uk","spamthisplease.com",
  "spamtrail.com","spamtroll.net","spamzz.com",
  "speed.1s.fr","spoofmail.de","stuffmail.de",
  "suremail.info","t.psh.me","tank.myfirewall.org",
  "teleworm.com","teleworm.us","temporaryemail.net",
  "temporaryemail.us","temporaryforwarding.com",
  "temporaryinbox.com","temporarymail.org",
  "tempymail.com","thanks2short.com","thisisnotmyrealemail.com",
  "throwam.com","tilien.com","tittbit.in",
  "tmailinator.com","tp-email.com","trash-amil.com",
  "trash2009.com","trash2010.com","trash2011.com",
  "trashdevil.com","trashdevil.de","trashemail.de",
  "trbvm.com","trish.ml","trixtrux1.ru",
  "turual.com","twinmail.de","tyldd.com",
  "uggsrock.com","umail.net","upliftnow.com",
  "upliftnow.net","uroid.com","username.e4ward.com",
  "veryrealemail.com","vidchart.com","viditag.com",
  "viewcastmedia.com","viewcastmedia.net","viewcastmedia.org",
  "viralplays.com","vkcode.ru","vmani.com",
  "vomoto.com","vpn.st","vsimcard.com",
  "vtxmail.us","wanmail.de","webemail.me",
  "webm4il.info","wegwerfadresse.de","wegwerfemail.de",
  "wegwerfemail.net","wegwerfemail.org","wegwerfmail.de",
  "wegwerfmail.net","wegwerfmail.org","wetrainbayarea.org",
  "wh4f.org","whatpaas.com","whopy.com",
  "whyspam.me","wilemail.com","willhackforfood.biz",
  "willselfdestruct.com","winemaven.info","wronghead.com",
  "wuzupmail.net","www.e4ward.com","wwwnew.eu",
  "x1x.spb.ru","xagloo.com","xemaps.com",
  "xents.com","xmaily.com","xoxy.net",
  "xsmail.com","xww.ro","xyz.am",
  "yahoohao.com","yapped.net","yeah.net",
  "yep.it","yodx.ro","yogamaven.com",
  "yopmail.pp.ua","yopmailpro.com","you-spam.com",
  "yourdomain.com","ypmail.webarnak.fr.eu.org",
  "yuurok.com","z1p.biz","za.com",
  "zehnminuten.de","zehnminutenmail.de","zetmail.com",
  "zippymail.info","zoemail.net","zoemail.org",
  "zomg.info","zxcv.com","zxcvbnm.com",
]);

/** Returns true if the email's domain is a known disposable provider. */
export function isDisposableEmail(email: string): boolean {
  const parts = email.toLowerCase().split("@");
  if (parts.length !== 2) return false;
  const domain = parts[1];
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  // Also catch subdomains of known disposable providers (e.g. user@mail.mailinator.com)
  const parentDomain = domain.split(".").slice(-2).join(".");
  return DISPOSABLE_DOMAINS.has(parentDomain);
}
