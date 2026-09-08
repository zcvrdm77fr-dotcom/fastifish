// Safe localStorage wrapper to prevent crashes in private tabs or restrictive WebViews where localStorage throws SecurityErrors
const storage = {
  getItem(key) {
    try {
      const val = localStorage.getItem(key);
      if (val !== null) return val;
    } catch (e) {
      // Ignore and fallback to cookie
    }
    try {
      const nameEQ = key + "=";
      const ca = document.cookie.split(';');
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
      }
    } catch (e) {
      // Ignore
    }
    return this._fallback[key] || null;
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // Ignore
    }
    try {
      const date = new Date();
      date.setTime(date.getTime() + (365 * 24 * 60 * 60 * 1000));
      const expires = "; expires=" + date.toUTCString();
      document.cookie = key + "=" + encodeURIComponent(value) + expires + "; path=/; SameSite=Lax";
    } catch (e) {
      // Ignore
    }
    this._fallback[key] = value;
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // Ignore
    }
    try {
      document.cookie = key + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax";
    } catch (e) {
      // Ignore
    }
    delete this._fallback[key];
  },
  _fallback: {}
};

const LOCATIONS = [
  {name:"Ahvenanmaa - Maarianhamina", lat:60.0973, lon:19.9348},
  {name:"Akaa - Kirkkojärvi", lat:61.1700, lon:23.8670},
  {name:"Alajärvi - Lappajärvi", lat:63.0000, lon:23.8150},
  {name:"Alavieska - Kalajoki", lat:64.1660, lon:24.2830},
  {name:"Alavus - Kuorasjärvi", lat:62.6160, lon:23.3660},
  {name:"Asikkala - Päijänne / Vääksy", lat:61.1723, lon:25.5474},
  {name:"Askola - Porvoonjoki", lat:60.5170, lon:25.4830},
  {name:"Enontekiö - Kilpisjärvi", lat:69.0453, lon:20.7984},
  {name:"Espoo - Laajalahti", lat:60.2055, lon:24.7570},
  {name:"Eurajoki - Eurajoki / meri", lat:61.2000, lon:21.7333},
  {name:"Evijärvi - Evijärvi", lat:63.4170, lon:23.4830},
  {name:"Forssa - Loimijoki", lat:60.8146, lon:23.6217},
  {name:"Haapajärvi - Kalajoki", lat:63.7500, lon:25.3160},
  {name:"Haapavesi - Pyhäjoki", lat:64.1330, lon:25.3830},
  {name:"Hailuoto - Perämeri", lat:65.0094, lon:24.7136},
  {name:"Halsua - Halsuanjärvi", lat:63.4830, lon:24.1000},
  {name:"Hamina - Itäinen Suomenlahti", lat:60.5697, lon:27.1979},
  {name:"Hankasalmi - Kynsivesi", lat:62.3830, lon:26.4500},
  {name:"Hanko - Hangon merialue", lat:59.8333, lon:22.9500},
  {name:"Hartola - Jääsjärvi", lat:61.5830, lon:26.0170},
  {name:"Hattula - Vanajavesi", lat:61.0500, lon:24.3660},
  {name:"Hauho - Hauhonselkä", lat:61.1660, lon:24.5500},
  {name:"Hausjärvi - Hikiänjoki", lat:60.8500, lon:24.9170},
  {name:"Heinola - Kymijoki / Ruotsalainen", lat:61.2056, lon:26.0381},
  {name:"Heinävesi - Kermajärvi", lat:62.4330, lon:28.6330},
  {name:"Helsinki - Suomenlahti", lat:60.1699, lon:24.9384},
  {name:"Hirvensalmi - Puulavesi", lat:61.6333, lon:26.8000},
  {name:"Hyrynsalmi - Emäjoki", lat:64.6667, lon:28.5333},
  {name:"Hyvinkää - Vantaanjoki", lat:60.6330, lon:24.8670},
  {name:"Hämeenlinna - Vanajavesi", lat:60.9959, lon:24.4643},
  {name:"Iisalmi - Porovesi", lat:63.5592, lon:27.1907},
  {name:"Iitti - Kymijoki", lat:60.8939, lon:26.3387},
  {name:"Ii - Iijoki", lat:65.3174, lon:25.3731},
  {name:"Ikaalinen - Kyrösjärvi", lat:61.7697, lon:23.0658},
  {name:"Ilmajoki - Kyrönjoki", lat:62.7330, lon:22.5660},
  {name:"Ilomantsi - Koitajoki", lat:62.6716, lon:30.9328},
  {name:"Ilomantsi - Koitere", lat:62.8830, lon:30.4160},
  {name:"Imatra - Vuoksi", lat:61.1697, lon:28.7641},
  {name:"Inari - Inarijärvi", lat:68.9059, lon:27.0286},
  {name:"Inari - Juutuanjoki", lat:68.9000, lon:26.9660},
  {name:"Inari - Näätämöjoki", lat:69.5330, lon:28.9160},
  {name:"Inkoo - Saaristo", lat:60.0450, lon:24.0040},
  {name:"Isojoki - Isojoki", lat:62.1000, lon:21.9330},
  {name:"Isokyrö - Kyrönjoki", lat:63.0000, lon:22.3160},
  {name:"Ivalo - Ivalojoki", lat:68.6560, lon:27.5389},
  {name:"Joensuu - Pyhäselkä", lat:62.6010, lon:29.7636},
  {name:"Jokioinen - Jokioistenjoki", lat:60.8120, lon:23.4830},
  {name:"Joroinen - Sysmäjärvi", lat:62.1830, lon:27.8160},
  {name:"Joutsa - Suontee", lat:61.7330, lon:26.1160},
  {name:"Juuka - Pielinen", lat:63.2333, lon:29.2500},
  {name:"Juupajoki - Kopsamo", lat:61.7830, lon:24.4500},
  {name:"Juva - Jukajärvi", lat:61.8830, lon:27.8500},
  {name:"Juva - Kangasjärvi", lat:62.0100, lon:27.3689},
  {name:"Jyväskylä - Päijänne", lat:62.2426, lon:25.7473},
  {name:"Jämsä - Längelmävesi", lat:61.7330, lon:24.8160},
  {name:"Jämsä - Päijänne", lat:61.8640, lon:25.1900},
  {name:"Kaarina - Kuusistonlahti", lat:60.4072, lon:22.3694},
  {name:"Kaavi - Kaavinjärvi", lat:63.1000, lon:28.5170},
  {name:"Kajaani - Oulujärvi", lat:64.2273, lon:27.7285},
  {name:"Kalajoki - Perämeri", lat:64.2600, lon:23.9500},
  {name:"Kangasala - Roine", lat:61.4631, lon:24.0764},
  {name:"Kangasniemi - Kyyvesi", lat:62.0160, lon:27.0500},
  {name:"Kangasniemi - Puulavesi", lat:61.9830, lon:26.6330},
  {name:"Kannonkoski - Kivijärvi", lat:62.9660, lon:25.2660},
  {name:"Kannus - Kannonjärvi", lat:63.9000, lon:23.9000},
  {name:"Karijoki - Karijoenjoki", lat:62.3000, lon:21.9000},
  {name:"Karkkila - Pyhäjärvi", lat:60.5340, lon:24.2100},
  {name:"Karstula - Pääjärvi", lat:62.8830, lon:24.8160},
  {name:"Kaskinen - Selkämeri", lat:62.3830, lon:21.2160},
  {name:"Kauhajoki - Kyrönjoki", lat:62.4160, lon:22.1830},
  {name:"Kauhava - Lapuanjoki", lat:63.1000, lon:23.0670},
  {name:"Kaustinen - Perhonjoki", lat:63.5500, lon:23.6830},
  {name:"Keitele - Nilakka", lat:63.1830, lon:26.3500},
  {name:"Kemijärvi - Kemijärvi", lat:66.7133, lon:27.4306},
  {name:"Keminmaa - Kemijoki", lat:65.8000, lon:24.5330},
  {name:"Kemiönsaari - Saaristomeri", lat:60.1600, lon:22.7300},
  {name:"Kemi - Perämeri", lat:65.7360, lon:24.5637},
  {name:"Kempele - Liminganlahti", lat:64.9170, lon:25.5000},
  {name:"Keuruu - Keurusselkä", lat:62.2609, lon:24.7064},
  {name:"Kihniö - Kirkkojärvi", lat:62.1830, lon:23.1830},
  {name:"Kinnula - Kinnulanjärvi", lat:63.3830, lon:24.9330},
  {name:"Kirkkonummi - Porkkala", lat:60.1238, lon:24.4385},
  {name:"Kitee - Puruvesi", lat:61.9660, lon:29.5330},
  {name:"Kitee - Pyhäjärvi", lat:62.1000, lon:30.1500},
  {name:"Kittilä - Jerisjärvi", lat:67.9160, lon:24.0330},
  {name:"Kittilä - Ounasjoki", lat:67.6533, lon:24.9110},
  {name:"Kiuruvesi - Kiuruvesi", lat:63.6500, lon:26.6160},
  {name:"Kivijärvi - Kivijärvi", lat:63.1160, lon:24.5830},
  {name:"Kokkola - Perämeri", lat:63.8385, lon:23.1307},
  {name:"Kolari - Tornionjoki", lat:67.3305, lon:23.7779},
  {name:"Konnevesi - Konnevesi", lat:62.6330, lon:26.2830},
  {name:"Kontiolahti - Höytiäinen", lat:62.7830, lon:29.7000},
  {name:"Korpilahti - Päijänne", lat:62.0160, lon:25.5660},
  {name:"Korsnäs - Merenkurkku", lat:62.7830, lon:21.1830},
  {name:"Kotka - Kymijoki / meri", lat:60.4664, lon:26.9458},
  {name:"Kouvola - Kymijoki", lat:60.8667, lon:26.7042},
  {name:"Kristiinankaupunki - Selkämeri", lat:62.2660, lon:21.3660},
  {name:"Kruunupyy - Kruunupyynjoki", lat:63.7170, lon:23.0170},
  {name:"Kuhmoinen - Päijänne", lat:61.5660, lon:25.1830},
  {name:"Kuhmo - Lammasjärvi", lat:64.1333, lon:29.5167},
  {name:"Kuhmo - Ontojärvi", lat:64.0830, lon:29.2500},
  {name:"Kuopio - Kallavesi", lat:62.8924, lon:27.6770},
  {name:"Kuopio - Nilsiä / Juankosken reitti", lat:63.2170, lon:28.1000},
  {name:"Kuopio - Syväri", lat:63.1660, lon:28.0500},
  {name:"Kuortane - Kuortaneenjärvi", lat:62.8160, lon:23.5160},
  {name:"Kurikka - Kyrönjoki", lat:62.6160, lon:22.4000},
  {name:"Kustavi - Vuosnainen", lat:60.5456, lon:21.3586},
  {name:"Kuusamo - Kitkajärvi", lat:65.9667, lon:29.1833},
  {name:"Kuusamo - Kuusinkijoki", lat:66.1660, lon:29.6160},
  {name:"Kuusamo - Oulankajoki", lat:66.3660, lon:29.3160},
  {name:"Kyyjärvi - Kyyjärvi", lat:63.0330, lon:24.5670},
  {name:"Kärkölä - Vähäjärvi", lat:60.9000, lon:25.2670},
  {name:"Kärsämäki - Pyhäjoki", lat:63.9830, lon:25.7660},
  {name:"Lahti - Kymijärvi (Nastolan raja)", lat:60.9696, lon:25.7993},
  {name:"Lahti - Vesijärvi", lat:60.9827, lon:25.6612},
  {name:"Laihia - Laihianjoki", lat:63.0000, lon:22.0170},
  {name:"Lapinjärvi - Lapinjärvi", lat:60.6330, lon:26.2000},
  {name:"Lapinlahti - Onkivesi", lat:63.2660, lon:27.4000},
  {name:"Lappeenranta - Saimaa", lat:61.0587, lon:28.1887},
  {name:"Lapua - Lapuanjoki", lat:62.9693, lon:23.0088},
  {name:"Laukaa - Lievestuoreenjärvi", lat:62.2660, lon:26.2000},
  {name:"Lempäälä - Pyhäjärvi", lat:61.3167, lon:23.7500},
  {name:"Leppävirta - Unnukka", lat:62.4830, lon:27.7830},
  {name:"Lestijärvi - Lestijärvi", lat:63.5160, lon:24.6660},
  {name:"Lieksa - Pielinen", lat:63.3167, lon:30.0167},
  {name:"Lieto - Aurajoki", lat:60.5101, lon:22.4618},
  {name:"Liminka - Liminganlahti", lat:64.8000, lon:25.4000},
  {name:"Liperi - Pyhäselkä", lat:62.5330, lon:29.3830},
  {name:"Liperi - Viinijärvi", lat:62.6870, lon:29.4400},
  {name:"Lohja - Lohjanjärvi", lat:60.2513, lon:24.0678},
  {name:"Loppi - Punelia", lat:60.7160, lon:24.2330},
  {name:"Loviisa - Pernajanlahti", lat:60.4566, lon:26.2251},
  {name:"Luhanka - Päijänne", lat:61.7670, lon:25.6830},
  {name:"Luumäki - Kivijärvi", lat:60.9667, lon:27.6667},
  {name:"Luoto - Luodon saaristo", lat:63.7500, lon:22.7000},
  {name:"Maalahti - Maalahdenjoki", lat:62.8830, lon:21.5670},
  {name:"Merijärvi - Merijärvi", lat:64.3170, lon:24.4000},
  {name:"Merikarvia - Merikarvianjoki", lat:61.8583, lon:21.5000},
  {name:"Mikkeli - Saimaa", lat:61.6886, lon:27.2723},
  {name:"Muhos - Oulujoki", lat:64.8160, lon:25.9830},
  {name:"Muonio - Muonionjoki", lat:67.9583, lon:23.6833},
  {name:"Mustasaari - Merenkurkku", lat:63.1144, lon:21.6822},
  {name:"Muurame - Muuratjärvi", lat:62.1160, lon:25.6000},
  {name:"Myrskylä - Myrskylänjoki", lat:60.6670, lon:25.9830},
  {name:"Mäntsälä - Mäntsälänjoki", lat:60.6330, lon:25.3170},
  {name:"Mänttä-Vilppula - Keurusselkä", lat:62.0309, lon:24.6275},
  {name:"Mäntyharju - Juolasvesi", lat:61.4160, lon:26.8330},
  {name:"Naantali - Saaristomeri", lat:60.4669, lon:22.0264},
  {name:"Nivala - Kalajoki", lat:63.9160, lon:24.9660},
  {name:"Nokia - Pyhäjärvi", lat:61.4773, lon:23.5086},
  {name:"Nurmes - Pielinen", lat:63.5421, lon:29.1397},
  {name:"Nurmijärvi - Vantaanjoki", lat:60.4670, lon:24.7830},
  {name:"Närpiö - Selkämeri", lat:62.4660, lon:21.3330},
  {name:"Orimattila - Porvoonjoki", lat:60.8000, lon:25.7330},
  {name:"Orivesi - Längelmävesi", lat:61.6830, lon:24.3660},
  {name:"Oulainen - Pyhäjoki", lat:64.2660, lon:24.8160},
  {name:"Oulu - Perämeri / Oulujoki", lat:65.0121, lon:25.4651},
  {name:"Outokumpu - Juojärvi", lat:62.7160, lon:28.8000},
  {name:"Padasjoki - Lummene", lat:61.4160, lon:25.0330},
  {name:"Padasjoki - Päijänne", lat:61.3508, lon:25.2761},
  {name:"Paltamo - Oulujärvi", lat:64.4000, lon:27.8333},
  {name:"Parainen - saaristo", lat:60.3000, lon:22.3000},
  {name:"Parikkala - Simpelejärvi", lat:61.5500, lon:29.5000},
  {name:"Parkano - Kirkkojärvi", lat:62.0170, lon:23.0170},
  {name:"Pedersöre - Perämeri", lat:63.8000, lon:22.7670},
  {name:"Pelkosenniemi - Kemijoki", lat:67.1108, lon:27.5106},
  {name:"Pello - Tornionjoki", lat:66.7735, lon:23.9622},
  {name:"Pertunmaa - Peruvesi", lat:61.4330, lon:26.4660},
  {name:"Petäjävesi - Petäjävesi", lat:62.2500, lon:25.1830},
  {name:"Pieksämäki - Pieksänjärvi", lat:62.3000, lon:27.1333},
  {name:"Pielavesi - Nilakka", lat:63.2160, lon:26.6160},
  {name:"Pielavesi - Pielavesi", lat:63.2333, lon:26.7500},
  {name:"Pietarsaari - Luodon saaristo", lat:63.6749, lon:22.7026},
  {name:"Pihtipudas - Kolima", lat:63.3833, lon:25.5667},
  {name:"Polvijärvi - Höytiäinen", lat:62.8670, lon:29.3830},
  {name:"Pori - Kokemäenjoki", lat:61.4851, lon:21.7972},
  {name:"Pornainen - Porvoonjoki", lat:60.4830, lon:25.4500},
  {name:"Porvoo - Porvoonjoki", lat:60.3923, lon:25.6651},
  {name:"Posio - Livojärvi", lat:66.1086, lon:28.1719},
  {name:"Posio - Simojärvi", lat:66.0880, lon:27.6630},
  {name:"Pudasjärvi - Iijoki", lat:65.3830, lon:26.9160},
  {name:"Pukkila - Porvoonjoki", lat:60.5000, lon:25.6670},
  {name:"Punkalaidun - Punkalaitumenjoki", lat:61.1500, lon:22.9830},
  {name:"Puumala - Lietvesi", lat:61.5330, lon:28.0500},
  {name:"Puumala - Saimaa", lat:61.5264, lon:28.1782},
  {name:"Pyhäjoki - Pyhäjoki / Meri", lat:64.4660, lon:24.2500},
  {name:"Pyhäjärvi - Pyhäjärvi", lat:63.6830, lon:25.9830},
  {name:"Pyhäntä - Pyhäntäjärvi", lat:64.0830, lon:26.0170},
  {name:"Pälkäne - Mallasvesi", lat:61.3330, lon:24.2660},
  {name:"Raahe - Perämeri", lat:64.6833, lon:24.4833},
  {name:"Raasepori - Karjaanjoki", lat:60.0750, lon:23.6670},
  {name:"Rantasalmi - Haukivesi", lat:62.0667, lon:28.3000},
  {name:"Ranua - Simojoki", lat:65.9167, lon:26.5167},
  {name:"Rauma - Selkämeri", lat:61.1280, lon:21.5113},
  {name:"Rautalampi - Rautalammin reitti", lat:62.6670, lon:26.4830},
  {name:"Rautavaara - Kangasjärvi", lat:63.6330, lon:28.2830},
  {name:"Reisjärvi - Reisjärvi", lat:63.7000, lon:24.4500},
  {name:"Riihimäki - Vantaanjoki", lat:60.7330, lon:24.7670},
  {name:"Ristiina - Yövesi", lat:61.5000, lon:27.2500},
  {name:"Ristijärvi - Hyrynjärvi", lat:64.5000, lon:28.2830},
  {name:"Rovaniemi - Kemijoki", lat:66.5039, lon:25.7294},
  {name:"Ruokolahti - Karjalanjärvi", lat:61.3500, lon:28.7160},
  {name:"Ruokolahti - Saimaa", lat:61.2833, lon:28.8333},
  {name:"Ruovesi - Näsijärvi", lat:61.9849, lon:24.0571},
  {name:"Ruovesi - Tarjanne", lat:62.0500, lon:23.9500},
  {name:"Rääkkylä - Oriveden reitti", lat:62.1830, lon:29.8670},
  {name:"Saarijärvi - Mahlunjärvi", lat:62.7500, lon:25.1000},
  {name:"Saarijärvi - Pyhäjärvi", lat:62.7049, lon:25.2536},
  {name:"Salla - Naruskajoki", lat:67.1160, lon:29.1830},
  {name:"Salo - Halikonlahti", lat:60.3833, lon:23.1333},
  {name:"Sastamala - Rautavesi", lat:61.3406, lon:22.9099},
  {name:"Savitaipale - Kuolimo", lat:61.2000, lon:27.6830},
  {name:"Savonlinna - Pihlajavesi", lat:61.8688, lon:28.8864},
  {name:"Savukoski - Kemijoki", lat:67.2910, lon:28.1660},
  {name:"Seinäjoki - Kyrönjoki", lat:62.7903, lon:22.8403},
  {name:"Sievi - Kalajoki", lat:63.9000, lon:24.5000},
  {name:"Siikajoki - Siikajoki", lat:64.8330, lon:24.7170},
  {name:"Siikalatva - Pyhäjoki", lat:64.1500, lon:25.9000},
  {name:"Siilinjärvi - Kallavesi", lat:63.0833, lon:27.6667},
  {name:"Simo - Simojoki", lat:65.6330, lon:25.0330},
  {name:"Sipoo - Sipoonlahti", lat:60.3775, lon:25.2691},
  {name:"Siuntio - Siuntionjoki", lat:60.2170, lon:24.1830},
  {name:"Sodankylä - Kitinen", lat:67.4167, lon:26.6000},
  {name:"Somero - Painio", lat:60.6160, lon:23.6330},
  {name:"Sonkajärvi - Sonkajärvi", lat:63.8660, lon:27.5330},
  {name:"Sotkamo - Nuasjärvi", lat:64.1330, lon:28.4170},
  {name:"Sulkava - Saimaa", lat:61.7877, lon:28.3728},
  {name:"Suomenniemi - Kuolimo", lat:61.3160, lon:27.4500},
  {name:"Suomussalmi - Kiantajärvi", lat:64.8861, lon:28.9078},
  {name:"Suomussalmi - Vuokkijärvi", lat:64.7160, lon:29.5660},
  {name:"Suonenjoki - Iisvesi", lat:62.6250, lon:27.1222},
  {name:"Sysmä - Päijänne", lat:61.5000, lon:25.6833},
  {name:"Säkylä - Pyhäjärvi", lat:61.0450, lon:22.3380},
  {name:"Taipalsaari - Saimaa", lat:61.1660, lon:28.0660},
  {name:"Taivalkoski - Iijoki", lat:65.5667, lon:28.2500},
  {name:"Tammela - Pyhäjärvi", lat:60.7830, lon:23.7660},
  {name:"Tammisaari - saaristo", lat:59.9736, lon:23.4339},
  {name:"Tampere - Näsijärvi / Pyhäjärvi", lat:61.4978, lon:23.7610},
  {name:"Tervola - Kemijoki", lat:66.0830, lon:24.8170},
  {name:"Tervo - Tervonselkä", lat:62.9170, lon:26.7330},
  {name:"Teuva - Teuvanjoki", lat:62.4830, lon:21.7500},
  {name:"Tohmajärvi - Kiteenjoki", lat:62.1830, lon:30.3830},
  {name:"Toholampi - Kirkkojärvi", lat:63.7500, lon:24.2330},
  {name:"Toivakka - Päijänne", lat:62.1000, lon:26.0830},
  {name:"Tornio - Tornionjoki", lat:65.8481, lon:24.1466},
  {name:"Turku - Aurajoki / Saaristomeri", lat:60.4518, lon:22.2666},
  {name:"Tuusula - Tuusulanjärvi", lat:60.4280, lon:25.0430},
  {name:"Tyrnävä - Tyrnävänjoki", lat:64.7830, lon:25.6170},
  {name:"Urjala - Nuutajärvi", lat:61.0830, lon:23.5330},
  {name:"Utajärvi - Oulujoki", lat:64.7670, lon:26.4000},
  {name:"Utsjoki - Kevojoki", lat:69.5660, lon:26.9660},
  {name:"Utsjoki - Nuorgam", lat:70.0830, lon:27.8660},
  {name:"Utsjoki - Tenojoki", lat:69.9086, lon:27.0284},
  {name:"Uurainen - Uuraisjärvi", lat:62.5670, lon:25.7170},
  {name:"Uusikaarlepyy - Perämeri", lat:63.5160, lon:22.5160},
  {name:"Uusikaupunki - Selkämeri", lat:60.8004, lon:21.4084},
  {name:"Vaala - Oulujärvi", lat:64.5500, lon:26.8330},
  {name:"Vaasa - Merenkurkku", lat:63.0951, lon:21.6165},
  {name:"Valkeakoski - Vanajavesi", lat:61.2642, lon:24.0319},
  {name:"Valtimo - Valtimonjoki", lat:63.6330, lon:28.8170},
  {name:"Vantaa - Vantaanjoki", lat:60.2941, lon:25.0400},
  {name:"Varkaus - Haukivesi / Unnukka", lat:62.3153, lon:27.8730},
  {name:"Veteli - Räyringinjärvi", lat:63.4830, lon:24.0170},
  {name:"Vieremä - Iisalmen reitti", lat:63.6670, lon:26.8500},
  {name:"Vihti - Hiidenvesi", lat:60.3660, lon:24.1660},
  {name:"Viitasaari - Keitele", lat:63.0667, lon:25.8667},
  {name:"Viitasaari - Muurasjärvi", lat:63.3000, lon:25.2660},
  {name:"Vimpeli - Vimpelinjärvi", lat:63.1830, lon:23.8170},
  {name:"Virrat - Toisvesi", lat:62.2476, lon:23.7805},
  {name:"Virrat - Vaskivesi", lat:62.2000, lon:23.7660},
  {name:"Vähäkyrö - Kyrönjoki", lat:63.0500, lon:22.1000},
  {name:"Vöyri - Vöyrinjoki", lat:63.1000, lon:21.8500},
  {name:"Ylistaro - Kyrönjoki", lat:62.9500, lon:22.5160},
  {name:"Ylitornio - Tornionjoki", lat:66.3160, lon:23.6660},
  {name:"Ylivieska - Kalajoki", lat:64.0660, lon:24.5330},
  {name:"Ylöjärvi - Näsijärvi", lat:61.5563, lon:23.5961},
  {name:"Ypäjä - Loimijoki", lat:60.7500, lon:23.0830},
  {name:"Ähtäri - Ähtärinjärvi", lat:62.5540, lon:24.0619},
  {name:"Äänekoski - Keitele", lat:62.6000, lon:25.7333}
];

const UI_TRANS = {
  fi: {
    title: "FastFishing - kalakelien mittari ja vieheopas",
    tab_kelimittari: "Kelimittari",
    tab_uistimet: "Uistimet",
    tab_kalalajit: "Kalalajit",
    tab_varusteet: "Varusteet",
    tab_merikartta: "Kalastuskartta",
    tab_linkit: "Linkit",
    hero_eyebrow: "Milloin kala puree parhaiten?",
    hero_title: "Tiedä milloin heittää",
    hero_lead: "FastFishing yhdistää reaaliaikaisen sään, ilmanpaineen kehityksen ja kuun vaiheen läpinäkyväksi kalakeliarvioksi. Vertaile ajankohtia ja katso käytännön viehesuositukset heti.",
    hero_btn_check: "Katso kelimittari",
    hero_btn_lure: "Katso viehesuositukset",
    panel_title: "Valitse kohde ja kala",
    panel_pill: "Hae säätila",
    label_search: "Hae paikkaa",
    placeholder_search: "esim. Saimaa, Ruka, Bahamasaaret...",
    label_selected: "Valittu paikka",
    label_species: "Kohdekala",
    btn_refresh: "Päivitä keli",
    nearby_title: "Suositellut kalapaikat lähelläsi",
    nearby_status_loading: "Haetaan sijaintiasi selaimelta...",
    nearby_status_no_gps: "Sijaintia ei voitu hakea tai lupa evättiin. Käytetään valikoitua paikkaa.",
    nearby_status_not_finland: "GPS-sijaintisi on Suomen ulkopuolella. Vaihdettu kieleksi englanti.",
    nearby_status_loading_weather: "Haetaan lähimpien paikkojen säätietoja...",
    nearby_status_failed: "Säätietojen haku epäonnistui.",
    nearby_status_ok: "Lähimmät kalapaikat kelitietoineen:",
    page_kelimittari_title: "Kelimittari",
    page_kelimittari_desc: "Suuntaa-antava arvio siitä, onko nyt järkeä lähteä rantaan vai keittää vielä kahvit.",
    page_uistimet_title: "Uistimet ja vieheet",
    page_uistimet_desc: "Valitse kohdekala alta. Pääset omalle sivulle, jossa on vesivinkit sekä ihan oikeita uistinehdotuksia merkkeineen ja malleineen - ei vain väriä ja tyyppiä.",
    lure_rules_title: "Nyrkkisäännöt",
    lure_rules_desc: "Näillä pääsee alkuun, vaikka järvi tai joki olisi uusi.",
    page_kalalajit_title: "Kalalajit",
    page_kalalajit_desc: "Missä kala yleensä luuraa ja millä kannattaa aloittaa ennen kuin rasia leviää laiturille.",
    page_varusteet_title: "Varusteet ja taktiikat",
    page_varusteet_desc: "Pieni muistilista ennen kuin lähdet rannalle tai veneelle.",
    page_merikartta_title: "Kalastus- ja merikartta",
    page_merikartta_desc: "Avaa Suomen kalapaikat heti kartalle, suodata kohdekalan mukaan ja tarkista paras paikka ennen lähtöä.",
    page_linkit_title: "Hyötylinkit",
    page_linkit_desc: "Ostohakuja, sääpalveluja ja virallisia linkkejä samassa nipussa.",
    label_pressure_delta: "Ilmanpaineen muutos (hPa/3h)",
    label_wind: "Tuulen nopeus (m/s)",
    label_temp: "Veden/Ilman lämpö (°C)",
    label_cloud: "Pilvisyys",
    label_prime: "Onko paras syöntiaika (aamu/ilta hämärä)?",
    btn_manual_calc: "Laske kelipisteet käsin",
    daily_forecast_title: "7 vuorokauden syöntiennuste",
    daily_forecast_sub: "Valitse päivä nähdäksesi sen tuntikohtaisen ennusteen",
    footer_text: "Sääaineisto: Open-Meteo. Kuun vaihe lasketaan selaimessa. Pisteytys on suuntaa-antava: kalastuspaikka, veden lämpö, ravintokalojen liike ja paikallinen paine voivat ratkaista enemmän kuin mikään yksittäinen mittari.",
    footer_privacy: "Tietosuojaseloste",
    footer_about: "Tietoa meistä",
    verdict_failed: "Sään haku ei onnistunut. Syötä keli käsin alla olevaan lomakkeeseen.",
    updated_failed: "Käsin syötetty keli · ",
    updated_manual: "Käsin syötetty keli · ",
    updated_loading: "Hetki...",
    updated_loc_label: " · päivitetty ",
    updated_init: "Valmis hakemaan kelitiedot.",
    direction_n: "pohjoiseen",
    direction_ne: "koilliseen",
    direction_e: "itään",
    direction_se: "kaakkoon",
    direction_s: "etelään",
    direction_sw: "lounaaseen",
    direction_w: "länteen",
    direction_nw: "luoteeseen",
    results_found: "Löytyi {count} paikkaa",
    no_results: "Ei tuloksia",
    lure_type_deep: "Syvännevaappu",
    lure_type_jig: "Jigi",
    lure_type_spoon: "Lusikka",
    lure_type_spinner: "Lippa",
    lure_type_surface: "Pintaviehe",
    lure_type_wobbler: "Vaappu",
    lure_search: "Hae vieheitä",
    cc_water: "Veden tila",
    cc_time: "Vuorokaudenaika",
    cc_moon: "Kuunvaihe",
    cc_time_tip_title: "Vuorokaudenajan vinkki",
    lure_now_badge: "Suositus juuri nyt",
    lure_color_label: "Väri ja tyyppi",
    lure_pick_desc: "Valitse kohdekala alta. Pääset omalle sivulle, jossa on vesivinkit sekä ihan oikeita uistinehdotuksia merkkeineen ja malleineen - ei vain väriä ja tyyppiä.",
    lure_pick_cta: "Katso uistinehdotukset →",
    lure_back: "← Takaisin kaikkiin kaloihin",
    real_lure_title: "Oikeat uistinehdotukset",
    real_lure_desc: "Konkreettisia merkkejä ja malleja, joilla pääset heti liikkeelle.",
    water_variants_title: "Vaihtoehdot veden mukaan",
    water_variants_desc: "Jos vesi ei juuri nyt ole mitatun kaltaista, kokeile jotain näistä.",
    fish_where: "Mistä etsiä:",
    fish_when: "Milloin yrittää:",
    fish_start: "Viehe alkuun:",
    fish_seasons_title: "Vuodenajat ja olosuhteet",
    fish_seasons_desc: "Miten sää, veden lämpötila ja vuodenaika muuttavat kalan käytöstä ja mitä kannattaa kokeilla."
  },
  en: {
    title: "FastFishing - Bite Index and Lure Guide",
    tab_kelimittari: "Bite Index",
    tab_uistimet: "Lures",
    tab_kalalajit: "Fish Species",
    tab_varusteet: "Gear",
    tab_merikartta: "Fishing Map",
    tab_linkit: "Links",
    hero_eyebrow: "When will the fish bite?",
    hero_title: "Know when to cast",
    hero_lead: "FastFishing combines real-time weather, pressure changes, and moon phase into a transparent bite index. Compare times and get practical lure suggestions instantly.",
    hero_btn_check: "Check Bite Index",
    hero_btn_lure: "See Lure Guide",
    panel_title: "Select Spot & Species",
    panel_pill: "Fetch Weather",
    label_search: "Search Location",
    placeholder_search: "e.g. Saimaa, Rovaniemi, Bahamas...",
    label_selected: "Selected Spot",
    label_species: "Target Fish",
    btn_refresh: "Fetch Weather",
    nearby_title: "Recommended fishing spots near you",
    nearby_status_loading: "Locating your browser position...",
    nearby_status_no_gps: "Location search failed or permission denied. Using selected spot.",
    nearby_status_not_finland: "GPS location is outside Finland. Set language to English.",
    nearby_status_loading_weather: "Fetching weather for nearby spots...",
    nearby_status_failed: "Weather fetch failed.",
    nearby_status_ok: "Closest fishing spots with weather conditions:",
    page_kelimittari_title: "Bite Index",
    page_kelimittari_desc: "A guiding estimate of whether it's worth hitting the water right now or making another cup of coffee.",
    page_uistimet_title: "Lures and Baits",
    page_uistimet_desc: "Select a target fish below. You'll land on its own page with water-clarity tips plus real lure suggestions, brands and models included - not just color and type.",
    lure_rules_title: "Golden Rules",
    lure_rules_desc: "Use these to get started, even if the lake or river is completely new to you.",
    page_kalalajit_title: "Fish Species",
    page_kalalajit_desc: "Where the fish usually hide and what to start with before your tackle box spills on the dock.",
    page_varusteet_title: "Gear & Tactics",
    page_varusteet_desc: "A quick checklist before heading out to the shore or boat.",
    page_merikartta_title: "Fishing & Marine Map",
    page_merikartta_desc: "Open fishing spots across Finland instantly, filter by target species, and compare the best options before heading out.",
    page_linkit_title: "Useful Links",
    page_linkit_desc: "License searches, weather services, and official links in one bundle.",
    label_pressure_delta: "Barometric Change (hPa/3h)",
    label_wind: "Wind Speed (m/s)",
    label_temp: "Water/Air Temp (°C)",
    label_cloud: "Cloud Cover",
    label_prime: "Is it prime time (dawn/dusk)?",
    btn_manual_calc: "Calculate Score Manually",
    daily_forecast_title: "7-day bite forecast",
    daily_forecast_sub: "Pick a day to see its hour-by-hour forecast",
    footer_text: "Weather data: Open-Meteo. Moon phase calculated in the browser. Scoring is a guide: fishing spot, water temperature, prey fish movement, and local pressure can matter more than any single meter.",
    footer_privacy: "Privacy Policy",
    footer_about: "About us",
    verdict_failed: "Weather search failed. Enter weather conditions manually in the form below.",
    updated_failed: "Manual weather · ",
    updated_manual: "Manual weather · ",
    updated_loading: "One moment...",
    updated_loc_label: " · updated ",
    updated_init: "Ready to fetch weather data.",
    direction_n: "north",
    direction_ne: "northeast",
    direction_e: "east",
    direction_se: "southeast",
    direction_s: "south",
    direction_sw: "southwest",
    direction_w: "west",
    direction_nw: "northwest",
    results_found: "Found {count} spots",
    no_results: "No results",
    lure_type_deep: "Deep diver",
    lure_type_jig: "Jig",
    lure_type_spoon: "Spoon",
    lure_type_spinner: "Spinner",
    lure_type_surface: "Topwater lure",
    lure_type_wobbler: "Wobbler",
    lure_search: "Search lures",
    cc_water: "Water condition",
    cc_time: "Time of day",
    cc_moon: "Moon phase",
    cc_time_tip_title: "Time-of-day tip",
    lure_now_badge: "Recommended right now",
    lure_color_label: "Color & type",
    lure_pick_desc: "Select a target fish below. You'll land on its own page with water-clarity tips plus real lure suggestions, brands and models included - not just color and type.",
    lure_pick_cta: "See lure suggestions →",
    lure_back: "← Back to all fish",
    real_lure_title: "Real lure suggestions",
    real_lure_desc: "Concrete brands and models to get you started right away.",
    water_variants_title: "Options by water clarity",
    water_variants_desc: "If the water isn't quite like what's measured right now, try one of these instead.",
    fish_where: "Where to look:",
    fish_when: "When to try:",
    fish_start: "Starting lure:",
    fish_seasons_title: "Seasons & conditions",
    fish_seasons_desc: "How weather, water temperature, and time of year change fish behavior - and what to try instead."
  }
};

const SPECIES_TRANS = {
  fi: [
    {id:"hauki", name:"Hauki"},
    {id:"kuha", name:"Kuha"},
    {id:"ahven", name:"Ahven"},
    {id:"taimen", name:"Taimen / lohi"},
    {id:"sarki", name:"Särkikalat"},
    {id:"karppi", name:"Karppi"},
    {id:"monni", name:"Monni"},
    {id:"mustebassi", name:"Mustebassi"},
    {id:"barbo", name:"Toutain"}
  ],
  en: [
    {id:"hauki", name:"Pike"},
    {id:"kuha", name:"Zander"},
    {id:"ahven", name:"Perch"},
    {id:"taimen", name:"Trout / Salmon"},
    {id:"sarki", name:"Coarse Fish / Roach"},
    {id:"karppi", name:"Carp"},
    {id:"monni", name:"Wels Catfish"},
    {id:"mustebassi", name:"Black Bass"},
    {id:"barbo", name:"Barbel"}
  ]
};

// Karkea arvio siitä, missä maissa kutakin kalalajia yleisesti tavataan (ISO 3166-1
// alpha-2 -maakoodit). Tarkoitus on rajata kalalajivalikko todennäköisiin lajeihin
// käyttäjän sijainnin perusteella - EI tyhjentävä tai tieteellisesti tarkka lista,
// vaan käytännön nyrkkisääntö. Maat, joita ei löydy tästä taulukosta, näyttävät
// edelleen koko lajivalikoiman (turvallinen oletus). Listaa voi laajentaa lisäämällä
// uusia maakoodeja kunkin lajin taulukkoon.
const SPECIES_COUNTRY_MAP = {
  // Hauki (Pike) - laajalti Euroopassa, Pohjois-Amerikassa; ei Australiassa/Uudessa-Seelannissa
  hauki:  ["FI","SE","NO","DK","EE","LV","LT","DE","NL","BE","FR","ES","IT","AT","CH","PL","CZ","SK","HU","RO","GB","IE","US","CA"],
  // Kuha (Zander/Pikeperch) - Keski- ja Itä-Eurooppa sekä istutettuna monin paikoin Länsi-Euroopassa
  kuha:   ["FI","SE","DE","NL","BE","FR","IT","PL","CZ","SK","HU","RO","AT","DK","EE","LV","LT","GB"],
  // Ahven (Perch) - hyvin laajalle levinnyt Euroopassa, myös Pohjois-Amerikan "yellow perch" ja Australian/Uuden-Seelannin istutuskannat
  ahven:  ["FI","SE","NO","DK","EE","LV","LT","DE","NL","BE","FR","ES","IT","AT","CH","PL","CZ","SK","HU","RO","GB","IE","US","CA","AU","NZ","PT"],
  // Taimen/lohi (Trout/Salmon) - lähes maailmanlaajuinen istutusten ansiosta
  taimen: ["FI","SE","NO","DK","EE","LV","LT","DE","NL","BE","FR","ES","IT","AT","CH","PL","CZ","SK","HU","RO","GB","IE","US","CA","AU","NZ","PT"],
  // Särkikalat (Coarse fish/Roach) - Euroopassa yleisiä, harvinaisempia/vieraslajeja muualla
  sarki:  ["FI","SE","NO","DK","EE","LV","LT","DE","NL","BE","FR","IT","AT","PL","CZ","SK","HU","RO","GB","IE","AU"],
  // Maakohtaiset lisälajit ja -laajennukset. Toistaiseksi tehty valmiiksi: Ranska, Portugali
  // (lisätään muita maita myöhemmin yksi kerrallaan, jotta sisältö - viehevinkit, kalatiedot
  // jne - ehditään kirjoittaa kunnolla kummallakin kielellä).
  // Karppi - Ranskassa erittäin suosittu ja runsas kohdelaji; Portugalissa yleinen padoissa ja joissa
  karppi: ["FR","PT"],
  // Monni (Silure/Wels-monni) - kotiutunut vahvasti mm. Ranskan Rhôneen, Saôneen ja Seineen sekä Portugalin Tejo-jokeen
  monni: ["FR","PT"],
  // Mustebassi (Black bass / Micropterus salmoides) - suosittu urheilukalastuslaji Etelä- ja Keski-Ranskan
  // järvissä sekä erityisesti Portugalin Alqueva-tekojärvellä, joka tunnetaan maailmanlaajuisesti bassivetenä
  mustebassi: ["FR","PT"],
  // Toutain/Barbo (Iberian barbel, Luciobarbus spp.) - Portugalin joki- ja patoalueiden perinteinen kohdelaji
  barbo: ["PT"]
};

// Käyttäjän GPS-sijainnista päätelty maakoodi (esim. "FR"). Null = ei tiedossa,
// jolloin näytetään aina koko lajivalikoima.
let detectedCountryCode = null;

// Lajit, jotka näytetään aina oletuksena (myös silloin kun sijaintia/maata ei tunnisteta).
// Maakohtaiset lisälajit (esim. karppi Ranskassa) näkyvät vain kun maa on tunnistettu.
const BASE_SPECIES_IDS = ["hauki","kuha","ahven","taimen","sarki"];

// Palauttaa kielikohtaisen lajilistan suodatettuna maan mukaan. Jos maa on tuntematon,
// näytetään perussarja (5 alkuperäistä lajia). Jos maa on tunnistettu mutta suodatus
// tyhjentäisi listan kokonaan, palataan turvallisesti perussarjaan.
function getSpeciesForCountry(lang, countryCode) {
  const all = SPECIES_TRANS[lang];
  const baseOnly = all.filter(s => BASE_SPECIES_IDS.includes(s.id));
  if (!countryCode) return baseOnly;
  const filtered = all.filter(s => {
    const countries = SPECIES_COUNTRY_MAP[s.id];
    return !countries || countries.includes(countryCode);
  });
  return filtered.length ? filtered : baseOnly;
}

// Hakee karkean maakoodin Nominatimin reverse-geokoodauksesta (kevyt zoom=3, eli
// vain maatason tarkkuus - ei tarvitse kylä-/kaupunkitasoa tähän tarkoitukseen).
async function detectCountryCode(lat, lon) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=3&accept-language=en`;
    const res = await fetch(url, {signal: controller.signal, headers:{"Accept":"application/json"}});
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    const cc = data && data.address && data.address.country_code;
    return cc ? cc.toUpperCase() : null;
  } catch (err) {
    clearTimeout(timeoutId);
    return null;
  }
}

// Päivittää lajivalikon (ja kaikki sitä käyttävät näkymät) tunnistetun maan mukaan.
function applyCountrySpeciesFilter() {
  if (typeof spSel === "undefined" || !spSel) return;
  const currentFishId = spSel.value;
  SPECIES = getSpeciesForCountry(currentLang, detectedCountryCode);
  spSel.innerHTML = "";
  SPECIES.forEach(s => spSel.add(new Option(s.name, s.id)));
  if (currentFishId && SPECIES.some(s => s.id === currentFishId)) {
    spSel.value = currentFishId;
  }
  renderFishInfo(spSel.value);
  if (typeof refresh === "function") refresh();
}

const LURES_TRANS = {
  fi: {
    hauki: {
      clear:{tag:"Kirkas vesi", name:"Luonnonvärinen haukivaappu", desc:"15-20 cm vaappu, hopea-sininen tai ahvenkuvio. Vedä hitaasti ja pidä pitkiä taukoja."},
      murky:{tag:"Samea / pilvinen", name:"Ärsykeväri ja leveä uinti", desc:"Oranssi, firetiger, keltainen tai musta. Kokeile lusikkaa, spinnerbaitia tai isoa shadia."},
      cold:{tag:"Kylmä vesi (kevätsyksy)", name:"Hidas suspari tai isohko jigi", desc:"Suspending-vaappu pitkillä leijutustauoilla tai tummasävyinen haukijigi syvältä."}
    },
    kuha: {
      clear:{tag:"Kirkas vesi", name:"Luonnollinen salakka/kuore-jigi", desc:"10-12 cm jigi, helmiäisvalkoinen, hopeinen tai vihertävä sävy. Keskity pohjan lähelle."},
      murky:{tag:"Samea vesi", name:"Keltaoranssi ärsykejigi", desc:"Fluori-vihreä tai kirkkaan keltainen v-pyrstöinen jigi. Kalasta iltahämärässä hieman ylempää."},
      cold:{tag:"Kylmä vesi / syvä", name:"Pystyjigi tai tasapainopilkki", desc:"Tarkka tarjoilu kaikuluotaimen avulla tai syvänteen päällä hitaasti uiva jigi."}
    },
    ahven: {
      clear:{tag:"Kirkas vesi", name:"Matojigi tai pikkulippa", desc:"Moottoriöljyn tai vihreän värinen jigi, tai koon 2 kuparilippa. Nopea, eloisa uitto."},
      murky:{tag:"Samea vesi", name:"Kirkas jigi tai värikäs lippa", desc:"Fluori-keltainen jigi tai koon 2-3 hopea-punainen lippa. Ärsytä ahven iskupisteillä."},
      cold:{tag:"Kylmä vesi", name:"Hidas mikrojigi tai tasapaino", desc:"Erittäin kevyt jigipää, tumma lierojigi tai pieni pystypilkki varovaisella liikkeellä."}
    },
    taimen: {
      clear:{tag:"Kirkas vesi", name:"Kapea lusikkauistin", desc:"Kromi, hopea-sininen tai vihertävä kapea lusikka. Nopea kelaus ja äkilliset pysäytykset."},
      murky:{tag:"Samea / tyrsky", name:"Kupari-punainen tai oranssi lusikka", desc:"Messinki, kupari tai ärsyke-oranssi lusikka tai pienehkö vilkasliikkeinen vaappu."},
      cold:{tag:"Kylmä vesi", name:"Hitaasti uppoava perho / putkiperho", desc:"Valkoinen, musta tai oliivi streameri joella, tai hidasliikkeinen vaappu merellä."}
    },
    sarki: {
      clear:{tag:"Kaikki kelit", name:"Kevyt onkilaite", desc:"Pieni herkkä koho, ohut siima, pieni koukku ja syötiksi kärpäsentoukka tai mato."},
      murky:{tag:"Samea vesi", name:"Tuoksuva pohjaonki", desc:"Pohjaonki varustettuna maissilla, madolla tai mäskitahnalla, joka houkuttelee tuoksullaan."},
      cold:{tag:"Kylmä vesi", name:"Erittäin pieni mikrosyötti", desc:"Käytä kaikkein pienimpiä kärpäsentoukkia tai leivänmurua aivan pohjan tuntumassa."}
    },
    karppi: {
      clear:{tag:"Kirkas vesi", name:"Hiuskoukku ja boili", desc:"Pieni 12-16 mm boili tai tiikeripähkinä hiuskoukussa, ohut siima ja pitkä syöttöaika. Karppi on kirkkaassa vedessä varovainen."},
      murky:{tag:"Samea vesi", name:"Tuoksuva pop-up ja mäskitys", desc:"Kirkasvärinen pop-up-boili (esim. ananas tai mansikka) kellutettuna hieman pohjasta, runsas mäskitys houkuttimeksi."},
      cold:{tag:"Kylmä vesi (kevätsyksy)", name:"Pieni syötti ja pitkä odotus", desc:"Pienempi syötti kuten maissi tai pelletti, syvänteen tai auringonpuoleisen rannan läheltä. Karppi syö hitaasti kylmässä vedessä."}
    },
    monni: {
      clear:{tag:"Kirkas vesi", name:"Iso vaappu tai isohko jigi", desc:"15-25 cm tummasävyinen vaappu tai musta/violetti softbait syötettynä hitaasti pohjan tuntumassa syvänteiden reunoilla."},
      murky:{tag:"Samea vesi", name:"Clonk-houkutus ja luonnonsyötti", desc:"Perinteinen clonking-tekniikka (äänihoukutus) yhdistettynä isoon luonnonsyöttiin, kuten kokonaiseen kalaan tai isoon maamatokimppuun."},
      cold:{tag:"Kylmä vesi / talvi", name:"Hidas pohjasyötti", desc:"Monni on kylmässä vedessä hidas ja passiivinen - tarjoile syvänteessä hitaasti liikkuva tai paikallaan pysyvä luonnonsyötti."}
    },
    mustebassi: {
      clear:{tag:"Kirkas vesi", name:"Luonnollinen soft plastic -syötti", desc:"Vihertävä tai luonnonvärinen worm tai creature bait keveällä texas-riggauksella, pitkillä tauoilla kasvillisuuden reunalla."},
      murky:{tag:"Samea vesi", name:"Isokokoinen ärsykevärinen spinnerbait", desc:"Musta-sininen tai firetiger-värinen spinnerbait tai chatterbait, jonka tärinä auttaa bassia löytämään syötin sameassa vedessä."},
      cold:{tag:"Kylmä vesi (kevätsyksy)", name:"Hidas jig ja pieni syötti", desc:"Pieni jig-and-pig tai droptshot-rigattu pienempi soft plastic hitaasti syvänteen pohjaa pitkin, mustebassi on kylmässä vedessä laiska."}
    },
    barbo: {
      clear:{tag:"Kirkas vesi", name:"Pieni luonnonsyötti pohjassa", desc:"Kastemato tai maissi kevyellä pohjasiimalla virtaavan veden alavirran puolella, kun toutain näkee syötin kaukaa."},
      murky:{tag:"Samea vesi", name:"Tuoksuva pellettisyötti", desc:"Pellettiseos tai mäskitahna houkuttimena, syötti pysyy pohjassa virran hidastumakohdassa."},
      cold:{tag:"Kylmä vesi (talvi)", name:"Pieni, hidas pohjasyötti", desc:"Toutain vetäytyy syvempiin patoaltaisiin talvella - tarjoile pieni syötti hitaasti aivan pohjan tuntumassa."}
    }
  },
  en: {
    hauki: {
      clear:{tag:"Clear Water", name:"Natural Pike Wobbler", desc:"15-20 cm wobbler, silver-blue or perch pattern. Retrieve slowly with long pauses."},
      murky:{tag:"Murky / Cloudy", name:"Attractor Color & Wide Action", desc:"Orange, firetiger, yellow or black. Try a spoon, spinnerbait, or big soft plastic shad."},
      cold:{tag:"Cold Water (Spring/Autumn)", name:"Slow Suspending Minnow or Big Jig", desc:"Suspending jerkbait with long neutrally-buoyant pauses, or a dark-colored soft bait retrieved deep."}
    },
    kuha: {
      clear:{tag:"Clear Water", name:"Natural Bleak/Smelt Jig", desc:"10-12 cm soft plastic jig, pearlescent white, silver, or greenish shade. Focus near the bottom."},
      murky:{tag:"Murky Water", name:"Yellow-Orange Attractor Jig", desc:"Chartreuse or bright yellow V-tail soft bait. Fish higher in the water column during dusk."},
      cold:{tag:"Cold Water / Deep", name:"Vertical Jig or Balance Jig", desc:"Precise presentation using sonar, or a slow-moving soft plastic swim jig over deep spots."}
    },
    ahven: {
      clear:{tag:"Clear Water", name:"Worm Jig or Small Spinner", desc:"Motor oil or green pumpkin soft bait, or a size 2 copper spinner. Fast, lively retrieve."},
      murky:{tag:"Murky Water", name:"Bright Jig or Colorful Spinner", desc:"Chartreuse jig or size 2-3 silver-red spinner. Irritate perch with high-contrast strike points."},
      cold:{tag:"Cold Water", name:"Slow Micro Jig or Balance", desc:"Very light jig head, dark worm-like soft bait, or a small vertical jig with gentle movements."}
    },
    taimen: {
      clear:{tag:"Clear Water", name:"Slender Spoon Lure", desc:"Chrome, silver-blue, or greenish slender spoon. Fast retrieve with sudden spin stops."},
      murky:{tag:"Murky / Surf", name:"Copper-Red or Orange Spoon", desc:"Brass, copper, or attractor orange spoon, or a small lively wobbler."},
      cold:{tag:"Cold Water", name:"Slowly Sinking Fly / Tube Fly", desc:"White, black, or olive streamer in rivers, or a slow-moving wobbler in the sea."}
    },
    sarki: {
      clear:{tag:"All Conditions", name:"Light Float Rig", desc:"Small sensitive float, thin line, tiny hook baited with a maggot, earthworm, or corn."},
      murky:{tag:"Murky Water", name:"Scented Bottom Ledger", desc:"Bottom ledger rig baited with corn, worm, or groundbait paste that attracts fish by smell."},
      cold:{tag:"Cold Water", name:"Extremely Small Micro Bait", desc:"Use the smallest maggots or breadcrumbs presented right on the bottom."}
    },
    karppi: {
      clear:{tag:"Clear Water", name:"Hair Rig & Small Boilie", desc:"A small 12-16 mm boilie or a tiger nut on a hair rig, light line and a long baiting period. Carp are wary in clear water."},
      murky:{tag:"Murky Water", name:"Scented Pop-up & Groundbait", desc:"A bright pop-up boilie (e.g. pineapple or strawberry) fished just off bottom, with generous groundbaiting to draw fish in."},
      cold:{tag:"Cold Water (Spring/Autumn)", name:"Small Bait & Long Wait", desc:"Smaller bait such as sweetcorn or pellets near a deep hole or a sun-warmed bank. Carp feed slowly in cold water."}
    },
    monni: {
      clear:{tag:"Clear Water", name:"Large Wobbler or Big Jig", desc:"A 15-25 cm dark-colored wobbler or a black/purple soft plastic worked slowly near the bottom along deep edges."},
      murky:{tag:"Murky Water", name:"Clonking & Natural Bait", desc:"Traditional clonking (sound-attraction technique) combined with a large natural bait such as a whole fish or a big bunch of nightcrawlers."},
      cold:{tag:"Cold Water / Winter", name:"Slow Bottom Bait", desc:"Wels catfish become slow and passive in cold water - offer a slow-moving or stationary natural bait in a deep hole."}
    },
    mustebassi: {
      clear:{tag:"Clear Water", name:"Natural Soft Plastic Bait", desc:"A green or natural-colored worm or creature bait on a light Texas rig, with long pauses along weed edges."},
      murky:{tag:"Murky Water", name:"Large Attractor Spinnerbait", desc:"A black-blue or firetiger colored spinnerbait or chatterbait, whose vibration helps bass find the bait in murky water."},
      cold:{tag:"Cold Water (Spring/Autumn)", name:"Slow Jig & Small Bait", desc:"A small jig-and-pig or a drop-shotted small soft plastic worked slowly along a deep bottom - bass are sluggish in cold water."}
    },
    barbo: {
      clear:{tag:"Clear Water", name:"Small Natural Bottom Bait", desc:"An earthworm or sweetcorn on a light bottom rig on the downstream side of the current, since barbel can spot bait from far away in clear water."},
      murky:{tag:"Murky Water", name:"Scented Pellet Bait", desc:"A pellet mix or groundbait paste as an attractor, with the bait held on the bottom where the current slows."},
      cold:{tag:"Cold Water (Winter)", name:"Small, Slow Bottom Bait", desc:"Barbel retreat to deeper pools below dams in winter - offer a small bait worked slowly right on the bottom."}
    }
  }
};

const REAL_LURES_TRANS = {
  fi: {
    hauki: [
      {brand:"Rapala", model:"X-Rap Twitchin' Mullet 10", type:"Pintaviehe", note:"Nykivä \"walk-the-dog\"-uinti aivan pinnassa. Toimii parhaiten tyynellä säällä hämärän aikaan, kun hauki jahtaa parvia pinnassa."},
      {brand:"Savage Gear", model:"3D Line Thru Pike Prey 17 cm", type:"Rikattava uistin", note:"Runko on syötetty vaijerin läpi, joten se kestää ison hauen puraisun eikä katkea koukun kohdalta."},
      {brand:"Rapala", model:"X-Rap Magnum XRMAG20", type:"Suspari (jerkbait)", note:"Uppoaa 1,5-4 metriin ja jää leijumaan tauolla - klassikko haukikelille, missä kala seisoo kasvillisuuden reunalla."},
      {brand:"Illex", model:"Depth Squad 25SR", type:"Nivelvaappu", note:"Uintisyvyys noin 2-3 metriä tasaisella vedolla, laaja sivuttaisliike houkuttelee hauen näkemään vieheen kauempaa."},
      {brand:"Westin", model:"Swim Jig 40 g + softshad", type:"Jigipää + softbait", note:"Pudota pohjaan ja pomputa hitaasti - toimii syvänteen reunalla etenkin kylmällä vedellä keväällä ja syksyllä."},
      {brand:"Rapala", model:"Down Deep Husky Jerk DHJ14", type:"Syvännevaappu", note:"Sukeltaa nopeasti 4-5 metriin ja pysyy siellä tasaisella vedolla - hyvä valinta selkeälle syvänteen reunalle."},
      {brand:"Blue Fox", model:"Vibrax Pike koko 6", type:"Lippa", note:"Voimakkaasti värisevä terä toimii hakuvieheenä sameassakin vedessä, kun paikkaa ei vielä tunneta."},
      {brand:"Savage Gear", model:"3D Suicide Duck 12,5 cm", type:"Pintaviehe", note:"Poikasjäljittelijä kesäisille kasvillisuusalueille - vedä hitaasti lampien ja ruovikon reunaa varhaisaamuna."},
      {brand:"Abu Garcia", model:"Toby 40 g", type:"Lusikka", note:"Painava heittolusikka, jolla kattaa nopeasti isoja avovesialueita ja löytää haukiparven tuntemattomalta järveltä."}
    ],
    kuha: [
      {brand:"Rapala", model:"Shad Rap SR07", type:"Matala vaappu", note:"Uintisyvyys noin 1-1,5 metriä. Kokeile hämärässä, kun kuha nousee matalikolle syömään."},
      {brand:"Westin", model:"Swim 12 cm kevyellä jigipäällä", type:"Softbait", note:"Kevyt 5-8 g jigipää pitää vieheen matalassa avoveden reunalla ilman että se uppoaa liikaa."},
      {brand:"Rapala", model:"X-Rap Jigging Shad Rap", type:"Jigivaappu", note:"Yhdistää jigin ja vaapun liikkeen - toimii hyvin 2-4 metrissä, kun kuha seuraa saalisparvea välivedessä."},
      {brand:"Savage Gear", model:"Cutbait Herring 15 cm", type:"Softbait jigillä", note:"Realistinen silakkamalli keskisyvyyteen, erityisen hyvä syksyn kuhakelillä."},
      {brand:"Berkley", model:"PowerBait Power Grub 5\" + 20-30 g jigipää", type:"Jigi", note:"Tuoksuva softbait aivan pohjan tuntumassa - kaikuluotain auttaa löytämään kuhaparven syvänteestä."},
      {brand:"Rapala", model:"Jigging Rap W7", type:"Pystyjigi", note:"Pudotetaan suoraan alas veneestä tai jäältä, toimii parhaiten kun kuha seisoo tarkasti tietyllä syvyydellä."},
      {brand:"Storm", model:"360GT Searchbait 12 cm", type:"Hakusoftbait", note:"Monikäyttöinen softbait, jolla kattaa nopeasti eri syvyyksiä ja löytää kuhaparven tuntemattomalta alueelta."},
      {brand:"Rapala", model:"CountDown CD9", type:"Uppovaappu", note:"Uppoaa tasaisesti, joten voit laskea vieheen juuri halutulle syvyydelle loivasti viettävän pohjan yllä."},
      {brand:"Westin", model:"Swim Glidebait 17 cm", type:"Liukuvaappu", note:"Hidas, leveä liukuva uinti tehoaa varovaisiin, kirkkaan veden kuhiin loppukesästä ja syksyllä."}
    ],
    ahven: [
      {brand:"Rapala", model:"Ultra Light Shad ULS04", type:"Pikkuvaappu", note:"Kevyt ja pieni, sopii ahvenparville, jotka jahtaavat kalanpoikasia aivan pinnan tuntumassa kesällä."},
      {brand:"Mepps", model:"Aglia koko 2", type:"Lippa", note:"Klassinen pyörivä lippa, nopea uitto tehoaa aktiivisiin, matalassa liikkuviin ahveniin."},
      {brand:"Berkley", model:"PowerBait Power Grub 3\" + 5-8 g jigipää", type:"Jigi", note:"Perusase ahvenelle 2-3 metrissä kivikoiden ja kasvillisuuden reunalla."},
      {brand:"Rapala", model:"Jigging Rap W3", type:"Pystyjigi", note:"Pieni pystyjigi, jota pomputellaan laiturilta tai veneestä - toimii hyvin ahvenparven yläpuolella."},
      {brand:"VMC", model:"Tumbler Jig + Gulp! 2\" Minnow", type:"Jigi", note:"Painava jigipää vie vieheen nopeasti pohjaan - isot ahvenet seisovat usein syvänteen reunalla."},
      {brand:"Rapala", model:"Slab Rap SLR05", type:"Pystyjigi", note:"Tiheä, väriseva liike houkuttelee ahvenen pureskelemaan myös syvässä ja kylmässä vedessä."},
      {brand:"Westin", model:"Swim Bull 6 cm", type:"Softbait", note:"Luonnollinen kalanpoikasjäljittelijä, hyvä hakuviehe ahvenparven paikallistamiseen rakenteiden liepeiltä."},
      {brand:"Blue Fox", model:"Vibrax koko 1", type:"Lippa", note:"Pieni, voimakkaasti värisevä lippa - klassinen hakuviehe kivikkoisilla rannoilla."},
      {brand:"Rapala", model:"Jigging Shad Rap 5 cm", type:"Jigivaappu", note:"Yhdistää pomputuksen ja liukuvan uinnin - tehokas veneestä kalastettaessa syvemmillä ahvenpaikoilla."}
    ],
    taimen: [
      {brand:"Abu Garcia", model:"Toby 12 g", type:"Lusikka", note:"Klassinen taimenlusikka virran niskalle ja koskien läheisyyteen - nopea kelaus, äkkipysäytys tuo osumat."},
      {brand:"Rapala", model:"Original Floater F11", type:"Vaappu", note:"Pintaan nouseva vaappu toimii hyönteisnousun aikaan tai hiljaisella virtauksella."},
      {brand:"Salmo", model:"Slider SD10", type:"Vaappu", note:"Uintisyvyys noin 1-3 metriä, laaja S-mutkainen uinti houkuttelee taimenta virran saumoilla."},
      {brand:"Blue Fox", model:"Vibrax Super Vibrax", type:"Lippa", note:"Värisevä terä toimii sameassakin vedessä, klassikko joki- ja rantakalastuksessa."},
      {brand:"Rapala", model:"Down Deep Husky Jerk DHJ12", type:"Syvännevaappu", note:"Sukeltaa syvälle suvantoihin - toimii etenkin kylmällä vedellä, kun taimen seisoo pohjan tuntumassa."},
      {brand:"Abu Garcia", model:"Toro 30-40 g", type:"Raskas lusikka", note:"Painava lusikka meren syvemmillä paikoilla ja virtaavassa vedessä, kun pintaviehe ei uppoa tarpeeksi."},
      {brand:"Rapala", model:"X-Rap 10", type:"Uppovaappu (jerkbait)", note:"Monikäyttöinen jerkbait joen suulle ja virran saumoihin - nykivä veto tauoilla tuo osumat."},
      {brand:"Mepps", model:"Aglia Long koko 2", type:"Pitkälippa", note:"Vilkkuva, pitkärunkoinen lippa toimii hyvin sameahkossa jokivedessä."},
      {brand:"Westin", model:"Swim Sandeel 15 cm", type:"Softbait", note:"Luonnollinen tuulenkalajäljittelijä rannikon taimenille, jotka syövät pikkukalaparvia."}
    ],
    sarki: [
      {brand:"Kevyt kohovapa", model:"Herkkä 1-2 g koho + koukku 16-18", type:"Kohokalastus", note:"Syötiksi vesiperhosen toukka tai pieni mato aivan pinnan tuntumaan, kun särki nousee syömään hyönteisiä."},
      {brand:"Leipäsyötti", model:"Leivänkuori pinnassa", type:"Pintasyötti", note:"Toimii etenkin lämpiminä iltoina laitureiden ja ruovikoiden lähellä."},
      {brand:"Method feeder", model:"Kevyt syöttikoriyhdistelmä + maissi", type:"Syöttikalastus", note:"Houkuttelee parven paikalle ja pitää syötin kasvillisuuden reunalla."},
      {brand:"Koho + pohjapaino", model:"Kevyt kohoyhdistelmä", type:"Kohokalastus", note:"Syötiksi toukka tai mato, koho säädetään niin että syötti roikkuu juuri kasvillisuuden yläpuolella."},
      {brand:"Pohjaonki", model:"Matolla tai maississa tuoksuva pohjavapa", type:"Pohjakalastus", note:"Kalasta aivan pohjan tuntumassa, kun särki vetäytyy syvemmälle kylmällä säällä."},
      {brand:"Raskas syöttikori", model:"Mäskitahnalla täytetty", type:"Syöttikalastus", note:"Tuoksu leviää tehokkaasti syvässä vedessä ja kokoaa parven pysyvästi paikalle."},
      {brand:"Waggler-koho", model:"Pitkävartinen koho + hieno siima", type:"Kohokalastus", note:"Kantaa pitkälle avoveden puolelle ja pysyy silti herkkänä hienoisillekin nykäisyille."},
      {brand:"Väritetty maissi", model:"Vaaleanpunainen tai keltainen maissi", type:"Syötti", note:"Erottuu luonnollisesta ravinnosta ja houkuttelee särjen usein nopeammin sameassa vedessä."},
      {brand:"Kastemato", model:"Pieni koukku, luonnollinen esitys", type:"Syötti", note:"Toimii ympäri vuoden ja on erityisen tehokas heti sateen jälkeen, kun matoja huuhtoutuu veteen."}
    ],
    karppi: [
      {brand:"Sensas", model:"Boilie 14 mm", type:"Hiuskoukkusyötti", note:"Kova boili hiuskoukussa pitää syötin tehokkaana pitkään, kun pikkukalat eivät pääse sitä nykimään."},
      {brand:"Korda", model:"Wafter Pop-up 15 mm", type:"Kellutettu syötti", note:"Nousee hieman pohjasta lietteisillä pohjilla ja erottuu paremmin mäskitetyssä syöttipaikassa."},
      {brand:"Fox", model:"Method Feeder -koriyhdistelmä", type:"Syöttikalastus", note:"Tiivis mäskipallo houkuttelee karpin nopeasti syöttipaikalle, erityisesti kanavissa ja järvissä."},
      {brand:"Nash", model:"Tiikeripähkinä hiuskoukussa", type:"Luonnonsyötti", note:"Klassinen, karppien suosima syötti, joka toimii hyvin esisyötetyillä paikoilla."}
    ],
    monni: [
      {brand:"Sportex", model:"Iso uistin tai clonker-tanko", type:"Clonking-houkutus", note:"Perinteinen ranskalainen monninkalastustekniikka - äänivärähtely houkuttelee monnin kauempaakin."},
      {brand:"Black Cat", model:"Iso softbait 20-30 cm", type:"Softbait", note:"Uitetaan hitaasti syvänteen pohjan tuntumassa, erityisesti lämpiminä kesäöinä."},
      {brand:"Team Catfish", model:"Kokonainen kala tai iso matokimppu", type:"Luonnonsyötti", note:"Tukevalla siimalla ja isolla koukulla varustettu syötti pohjaan, kun monni ei liiku aktiivisesti."}
    ],
    mustebassi: [
      {brand:"Illex", model:"Deracoup 106F", type:"Pintaviehe", note:"Ranskalainen bassiklassikko - toimii erinomaisesti kasvillisuuden reunalla aamu- ja iltahämärässä."},
      {brand:"Rapala", model:"CrushCity Rip Roller", type:"Softbait", note:"Monikäyttöinen softbait, joka jäljittelee luonnollista pikkukalaa kasvillisuuden reunalla."},
      {brand:"Berkley", model:"PowerBait Power Worm 10 cm", type:"Texas rig -syötti", note:"Klassinen madonjäljitelmä, joka uitetaan hitaasti pohjan tuntumassa kasvillisuudessa."},
      {brand:"Molix", model:"Chatter Bait 14 g", type:"Ärsykeviehe", note:"Voimakkaasti tärisevä viehe, joka toimii hyvin sameassa vedessä ja tuulisella säällä."}
    ],
    barbo: [
      {brand:"Sensas", model:"Pellettiseos + pohjasiima", type:"Pohjakalastus", note:"Pelletti tai mäskitahna houkuttimena, syötti kastematoa tai maissia pidettynä virran hidastumakohdassa."},
      {brand:"Rive", model:"Kevyt feeder-koriyhdistelmä", type:"Syöttikalastus", note:"Pitää syötin paikallaan virtaavassa vedessä ja levittää tuoksua tehokkaasti alavirtaan."},
      {brand:"Kastemato", model:"Iso kastemato pohjakoukussa", type:"Luonnonsyötti", note:"Klassinen toutainsyötti, joka toimii erityisen hyvin sateen jälkeen kohonneessa virtaamassa."}
    ]
  },
  en: {
    hauki: [
      {brand:"Rapala", model:"X-Rap Twitchin' Mullet 10", type:"Topwater lure", note:"A twitching \"walk-the-dog\" action right on the surface. Best in calm weather at dusk, when pike chase baitfish up top."},
      {brand:"Savage Gear", model:"3D Line Thru Pike Prey 17 cm", type:"Line-through swimbait", note:"The body is threaded on the leader wire, so it survives even the biggest pike bite without snapping at the hook."},
      {brand:"Rapala", model:"X-Rap Magnum XRMAG20", type:"Suspending jerkbait", note:"Sits at 1.5-4 m and hovers on the pause - a classic for pike holding along weed edges."},
      {brand:"Illex", model:"Depth Squad 25SR", type:"Jointed swimbait", note:"Runs about 2-3 m on a steady retrieve, with a wide side-to-side action that pike can spot from further away."},
      {brand:"Westin", model:"Swim Jig 40 g + soft shad", type:"Jighead + softbait", note:"Let it sink to bottom and hop it slowly - works well along deep drop-offs, especially in spring and autumn."},
      {brand:"Rapala", model:"Down Deep Husky Jerk DHJ14", type:"Deep diver", note:"Dives fast to 4-5 m and holds there on a steady retrieve - a solid choice for a well-defined deep edge."},
      {brand:"Blue Fox", model:"Vibrax Pike size 6", type:"Spinner", note:"A strong-vibrating blade that works well as a search bait in murky water when you don't know the spot yet."},
      {brand:"Savage Gear", model:"3D Suicide Duck 12.5 cm", type:"Topwater lure", note:"A fry imitation for summer weed beds - work it slowly along lily pads and reed edges early in the morning."},
      {brand:"Abu Garcia", model:"Toby 40 g", type:"Spoon", note:"A heavy casting spoon that covers large open-water areas fast and helps locate pike on an unfamiliar lake."}
    ],
    kuha: [
      {brand:"Rapala", model:"Shad Rap SR07", type:"Shallow shad", note:"Runs about 1-1.5 m. Try it at dusk when zander move onto shallow flats to feed."},
      {brand:"Westin", model:"Swim 12 cm on a light jighead", type:"Softbait", note:"A light 5-8 g jighead keeps the lure shallow along the edge of open water without sinking too fast."},
      {brand:"Rapala", model:"X-Rap Jigging Shad Rap", type:"Jigging swimbait", note:"Combines a jig and a swimbait action - works well at 2-4 m when zander follow baitfish mid-column."},
      {brand:"Savage Gear", model:"Cutbait Herring 15 cm", type:"Softbait on a jig", note:"A realistic herring imitation for mid-depth, especially strong during the autumn zander bite."},
      {brand:"Berkley", model:"PowerBait Power Grub 5\" + 20-30 g jighead", type:"Jig", note:"A scented softbait fished right on bottom - sonar helps you find the zander school in a deep hole."},
      {brand:"Rapala", model:"Jigging Rap W7", type:"Vertical jig", note:"Dropped straight down from a boat or through the ice, best when zander hold tight at a specific depth."},
      {brand:"Storm", model:"360GT Searchbait 12 cm", type:"Search softbait", note:"A versatile softbait that covers several depths quickly, great for locating zander in unfamiliar water."},
      {brand:"Rapala", model:"CountDown CD9", type:"Sinking wobbler", note:"Sinks at a steady rate, so you can count it down to the exact depth over a gently sloping bottom."},
      {brand:"Westin", model:"Swim Glidebait 17 cm", type:"Glidebait", note:"A slow, wide gliding action that works well on cautious clear-water zander in late summer and autumn."}
    ],
    ahven: [
      {brand:"Rapala", model:"Ultra Light Shad ULS04", type:"Micro swimbait", note:"Light and small, matches summer perch schools chasing fry right near the surface."},
      {brand:"Mepps", model:"Aglia size 2", type:"Spinner", note:"A classic in-line spinner - a fast retrieve triggers active perch feeding shallow."},
      {brand:"Berkley", model:"PowerBait Power Grub 3\" + 5-8 g jighead", type:"Jig", note:"A go-to perch setup for 2-3 m along rocky or weedy edges."},
      {brand:"Rapala", model:"Jigging Rap W3", type:"Vertical jig", note:"A small vertical jig worked from a dock or boat - effective right above a perch school."},
      {brand:"VMC", model:"Tumbler Jig + Gulp! 2\" Minnow", type:"Jig", note:"A heavier jighead gets down fast - bigger perch often hold along deep edges."},
      {brand:"Rapala", model:"Slab Rap SLR05", type:"Vertical jig", note:"A tight, vibrating action that still draws strikes in deep, cold water."},
      {brand:"Westin", model:"Swim Bull 6 cm", type:"Softbait", note:"A natural fry imitation, a good search bait for locating active perch schools around structure."},
      {brand:"Blue Fox", model:"Vibrax size 1", type:"Spinner", note:"A small, strongly vibrating blade - a classic search bait along rocky shorelines."},
      {brand:"Rapala", model:"Jigging Shad Rap 5 cm", type:"Jigging swimbait", note:"Combines a jigging and gliding action - effective from a boat over deeper perch marks."}
    ],
    taimen: [
      {brand:"Abu Garcia", model:"Toby 12 g", type:"Spoon", note:"A classic sea trout spoon for current seams and rapids - fast retrieve with a sudden stop triggers strikes."},
      {brand:"Rapala", model:"Original Floater F11", type:"Wobbler", note:"A floating wobbler that works well during a hatch or in gentle current."},
      {brand:"Salmo", model:"Slider SD10", type:"Wobbler", note:"Runs about 1-3 m with a wide S-curve action that draws trout along current seams."},
      {brand:"Blue Fox", model:"Vibrax Super Vibrax", type:"Spinner", note:"The vibrating blade works even in murky water - a river and shore-fishing classic."},
      {brand:"Rapala", model:"Down Deep Husky Jerk DHJ12", type:"Deep diver", note:"Dives deep into pools - especially effective in cold water when trout hold near the bottom."},
      {brand:"Abu Garcia", model:"Toro 30-40 g", type:"Heavy spoon", note:"A heavy spoon for deeper sea spots and stronger current, when a surface lure won't sink enough."},
      {brand:"Rapala", model:"X-Rap 10", type:"Sinking jerkbait", note:"A versatile jerkbait for river mouths and current seams - a twitch-pause retrieve triggers strikes."},
      {brand:"Mepps", model:"Aglia Long size 2", type:"Long spinner", note:"A flashy, elongated spinner that works well in slightly stained river water."},
      {brand:"Westin", model:"Swim Sandeel 15 cm", type:"Softbait", note:"A natural sandeel profile for coastal sea trout feeding on baitfish schools."}
    ],
    sarki: [
      {brand:"Light float rod", model:"Sensitive 1-2 g float + size 16-18 hook", type:"Float fishing", note:"Bait with a maggot or small worm right near the surface when roach rise to feed on insects."},
      {brand:"Bread bait", model:"Bread crust on the surface", type:"Surface bait", note:"Works especially well on warm evenings near docks and reed edges."},
      {brand:"Method feeder", model:"Light feeder cage + sweetcorn", type:"Feeder fishing", note:"Draws the school in and keeps the bait along a weed edge."},
      {brand:"Float rig", model:"Light float set-up", type:"Float fishing", note:"Bait with a maggot or worm, set so it hangs just above the weed line."},
      {brand:"Bottom ledger rig", model:"Worm or sweetcorn on a scented rig", type:"Bottom fishing", note:"Fish right on the bottom once roach move deeper in cold weather."},
      {brand:"Heavy feeder cage", model:"Filled with groundbait paste", type:"Feeder fishing", note:"The scent spreads efficiently in deep water and holds the school in place."},
      {brand:"Waggler float", model:"Long-bodied waggler + fine line", type:"Float fishing", note:"Casts further into open water while staying sensitive to even light bites."},
      {brand:"Dyed sweetcorn", model:"Bright pink or yellow corn", type:"Bait", note:"Stands out from natural food and often draws roach faster in coloured water."},
      {brand:"Earthworm", model:"Small hook, natural presentation", type:"Bait", note:"A year-round classic, especially effective right after rain when worms wash into the water."}
    ],
    karppi: [
      {brand:"Sensas", model:"Boilie 14 mm", type:"Hair rig bait", note:"A hard boilie on a hair rig stays effective for a long time, since small fish can't strip it off the hook."},
      {brand:"Korda", model:"Wafter Pop-up 15 mm", type:"Buoyant bait", note:"Sits slightly off a silty bottom and stands out better in a baited, groundbaited swim."},
      {brand:"Fox", model:"Method Feeder rig", type:"Feeder fishing", note:"A tight ball of groundbait draws carp to the swim quickly, especially in canals and lakes."},
      {brand:"Nash", model:"Tiger nut on a hair rig", type:"Natural bait", note:"A classic carp favorite that works especially well in a pre-baited swim."}
    ],
    monni: [
      {brand:"Sportex", model:"Large lure or clonking pole", type:"Clonking technique", note:"A traditional French wels catfish technique - the sound vibration draws catfish in from further away."},
      {brand:"Black Cat", model:"Large softbait 20-30 cm", type:"Softbait", note:"Worked slowly near the bottom of a deep hole, especially on warm summer nights."},
      {brand:"Team Catfish", model:"Whole fish or a large worm bunch", type:"Natural bait", note:"Sturdy line and a large hook presented on the bottom, for when catfish aren't actively moving."}
    ],
    mustebassi: [
      {brand:"Illex", model:"Deracoup 106F", type:"Topwater lure", note:"A French bass-fishing classic - excellent along weed edges at dawn and dusk."},
      {brand:"Rapala", model:"CrushCity Rip Roller", type:"Softbait", note:"A versatile softbait imitating natural baitfish along weed edges."},
      {brand:"Berkley", model:"PowerBait Power Worm 10 cm", type:"Texas-rigged bait", note:"A classic worm imitation worked slowly near the bottom through cover."},
      {brand:"Molix", model:"Chatter Bait 14 g", type:"Attractor lure", note:"A strongly vibrating lure that works well in murky water and windy conditions."}
    ],
    barbo: [
      {brand:"Sensas", model:"Pellet mix + bottom rig", type:"Bottom fishing", note:"Pellets or groundbait paste as an attractor, with earthworm or sweetcorn held where the current slows."},
      {brand:"Rive", model:"Light feeder cage", type:"Feeder fishing", note:"Holds the bait in place in flowing water and spreads scent efficiently downstream."},
      {brand:"Earthworm", model:"Large earthworm on a bottom hook", type:"Natural bait", note:"A classic barbel bait, especially effective after rain when the flow picks up."}
    ]
  }
};


const TIME_TRANS = {
  fi: {
    dawn: {label:"Aamuhämärä", tip:"Yksi vuorokauden parhaista hetkistä. Kala liikkuu usein matalammalla ja on rohkeampi - kokeile ensin nopeampaa, äänekästä tai pinnan lähellä kulkevaa viehettä."},
    day: {label:"Päivä", tip:"Kirkas päivänvalo painaa kalan usein syvemmälle tai varjoihin. Pienempi, luonnonvärinen viehe ja rauhallisempi vetotyyli toimii yleensä paremmin."},
    dusk: {label:"Iltahämärä", tip:"Toinen vahva syöntihetki. Vaihda tarvittaessa hieman tummempaan tai ärsykkeellisempään väriin auringon laskiessa ja hidasta vetoa illan pimetessä."},
    night: {label:"Yö", tip:"Isot kalat, kuten kuha ja hauki, voivat liikkua matalikoilla yöllä. Tumma silhuetti, ääntä tai värinää tekevä viehe ja hidas, tasainen veto toimivat parhaiten."}
  },
  en: {
    dawn: {label:"Dawn", tip:"One of the best windows of the day. Fish often sit shallower and bite more aggressively - try a faster, noisier, or shallow-running lure first."},
    day: {label:"Daytime", tip:"Bright daylight often pushes fish deeper or into shade. A smaller, natural-colored lure with a calmer retrieve usually works better."},
    dusk: {label:"Dusk", tip:"Another strong feeding window. Switch to a slightly darker or more attractor-style color as the sun sets, and slow the retrieve as it gets darker."},
    night: {label:"Night", tip:"Larger fish like zander and pike can move onto shallow flats at night. A dark silhouette lure with sound or vibration and a slow, steady retrieve works best."}
  }
};


const FISH_INFO_TRANS = {
  fi: {
    hauki: {title:"Hauki", mood:"Väijyvä petokala", where:"Ruovikot, matalat lahdet, karikon reunat, kasvillisuuden aukot ja pudotusten yläreunat.", when:"Kevät ja syksy ovat vahvoja. Kesähelteellä etsi viileämpää vettä ja kalasta aamu/ilta.", start:"Iso vaappu, lusikka, shad-jigi, spinnerbait tai jerkbait. Käytä aina puruperuketta.", color:"#78a857", image:"https://commons.wikimedia.org/wiki/Special:FilePath/Esox_lucius1.jpg"},
    kuha: {title:"Kuha", mood:"Hämärän saalistaja", where:"Syvänteiden reunat, kovapohjaiset penkat, salmet ja pikkukalaparvien ympäristö.", when:"Iltahämärä, yö ja pilvinen päivä. Lämmin kesävesi aktivoi kuhaa, mutta kirkas aurinko painaa sen syvemmälle.", start:"Jigi pohjan tuntumaan, kuhan vaappu vetoon tai pystypilkki veneestä.", color:"#c9b36a", image:"https://commons.wikimedia.org/wiki/Special:FilePath/Sander_lucioperca_1.jpg"},
    ahven: {title:"Ahven", mood:"Parvena liikkuva opportunisti", where:"Laiturit, kivikot, kasvillisuuden reunat, penkat ja pikkukalojen pinnassa näkyvät ajot.", when:"Kesällä usein koko päivän, mutta paras piikki tulee aamulla ja illalla. Kevyt tuuli auttaa.", start:"Mikrojigi, pieni lippa, pieni lusikka tai dropshot.", color:"#d88b3d", image:"https://commons.wikimedia.org/wiki/Special:FilePath/Perca_fluviatilis2.jpg"},
    taimen: {title:"Taimen / lohi", mood:"Viileän waterline-voimanpesä", where:"Virran saumat, niskat, suvannot, rantamatalat kylmällä vedellä ja hapekkaat selkävedet.", when:"Viileä vesi, pilvinen keli, tuuli ja hämärä ovat eduksi. Noudata aina rauhoituksia ja alamittoja.", start:"Kapea lusikka, vaappu, perho tai pieni jigi virran mukaan uitettuna.", color:"#b8c7d0", image:"https://commons.wikimedia.org/wiki/Special:FilePath/Brown_trout_Salmo_trutta.jpg"},
    sarki: {title:"Särkikalat", mood:"Kevyen ongen varma ilo", where:"Lämpimät lahdet, laiturit, ruovikon reunat ja pohjan tasaiset ruokailupaikat.", when:"Lämmin kausi ja tyyni tai leuto keli. Ruokinta kokoaa parvea.", start:"Koho-onki, pieni koukku, mato, toukka, maissi tai leipä.", color:"#d9d3ad", image:"https://commons.wikimedia.org/wiki/Special:FilePath/Common_Roach.JPG"},
    karppi: {title:"Karppi", mood:"Varovainen, älykäs pohjankaluaja", where:"Syvät pohjakuopat, kasvillisuuden reunat, lämpimät matalikot ja syöttöpaikat, joita on esisyötetty.", when:"Lämmin vesi keväästä syksyyn, erityisesti aamuyö ja ilta. Ukkosta edeltävä ilmanpaineen lasku aktivoi karppia.", start:"Boili tai maissi hiuskoukussa, pitkä syöttöaika ja kärsivällisyys.", color:"#a67c4a", image:"https://commons.wikimedia.org/wiki/Special:FilePath/Common_carp.jpg"},
    monni: {title:"Monni", mood:"Yön suurpeto syvänteissä", where:"Syvät joenmutkat, patojen alusvedet, suurten järvien syvänteet ja upotetut puurakenteet.", when:"Lämmin kesäyö on parasta aikaa. Ukkosen jälkeinen ilmanpaineen muutos saa monnin liikkeelle.", start:"Iso luonnonsyötti tai clonking-houkutus, tukeva varustus.", color:"#5a4a3a", image:"https://commons.wikimedia.org/wiki/Special:FilePath/Silurus_glanis_white2.JPG"},
    mustebassi: {title:"Mustebassi", mood:"Väijyvä kasvillisuuden kuningas", where:"Vesikasvillisuuden reunat, upotetut puut, laiturit ja varjoisat pudotukset lämpimissä järvissä.", when:"Lämmin vesi keväästä syksyyn, parhaat hetket aamu- ja iltahämärässä sekä pilvisellä säällä.", start:"Soft plastic -syötti texas-riggauksella tai pintaviehe kasvillisuuden reunalla.", color:"#3d5a3d", image:"https://commons.wikimedia.org/wiki/Special:FilePath/Largemouth_Bass_(Micropterus_salmoides).jpg"},
    barbo: {title:"Toutain", mood:"Virtaan sopeutunut pohjankaluaja", where:"Virtaavat joet, patojen alavedet, sorapohjat ja virran hidastumakohdat.", when:"Lämmin vesi keväästä syksyyn, erityisesti hämärän aikaan ja sateen jälkeen kohonneessa virtaamassa.", start:"Kastemato tai maissi pohjasiimalla, tarjoile aivan pohjan tuntumassa.", color:"#b09468", image:"https://commons.wikimedia.org/wiki/Special:FilePath/Barbel.jpg"}
  },
  en: {
    hauki: {title:"Pike", mood:"Predator that strikes in almost any weather", where:"Reed edges, shallow bays, rocky reefs, and steep drop-offs.", when:"Best on cloudy and windy days. Midday can be surprisingly productive.", start:"Large spoons, big wobblers, and specialized pike soft baits.", color:"#5b7553", image:"https://commons.wikimedia.org/wiki/Special:FilePath/Esox_lucius1.jpg"},
    kuha: {title:"Zander", mood:"Twilight hunter, lover of warm waters", where:"Open lake areas, deep water during the day, shallower rock piles and narrows in the evening.", when:"Best during dusk, night, and early morning. Calm and warm conditions are ideal.", start:"Soft plastic jigs (10-12 cm), zander wobblers, and deadbaits.", color:"#989069", image:"https://commons.wikimedia.org/wiki/Special:FilePath/Sander_lucioperca_Sverige.jpg"},
    ahven: {title:"Perch", mood:"Lively school hunter and national favorite", where:"Reed lines, bridge pilings, rocky shoals, and weed beds.", when:"Active daytime feeder. Feeding often intensifies in the afternoon and early evening on calm days.", start:"Micro & small jigs (5-8 cm), spinners (size 2-3), and small wobblers.", color:"#4a6750", image:"https://commons.wikimedia.org/wiki/Special:FilePath/European_perch_Perca_fluviatilis.jpg"},
    taimen: {title:"Trout / Salmon", mood:"Streamlined powerhouse of cold waters", where:"Rocky currents, river pools, fast rapids, and wave-swept shores of the outer archipelago.", when:"When water temperature drops in autumn or spring. Windy and cloudy days are best at sea.", start:"Slender spoons, sea trout wobblers, and streamer flies.", color:"#7a6a57", image:"https://commons.wikimedia.org/wiki/Special:FilePath/Salmo_trutta_pictu.jpg"},
    sarki: {title:"Coarse Fish / Roach", mood:"Surefire fun on a light float rig", where:"Warm bays, harbors, reed edges, and flat muddy bottoms where they feed.", when:"Warm season and calm or gentle weather. Groundbaiting helps gather the school.", start:"Float rod, tiny hook, earthworm, maggot, sweetcorn, or bread.", color:"#d9d3ad", image:"https://commons.wikimedia.org/wiki/Special:FilePath/Common_Roach.JPG"},
    karppi: {title:"Carp", mood:"Wary, intelligent bottom feeder", where:"Deep bottom holes, weed edges, warm shallows, and pre-baited swims.", when:"Warm water from spring to autumn, especially early morning and evening. A pressure drop before a thunderstorm often triggers feeding.", start:"Boilie or sweetcorn on a hair rig, a long baiting period, and patience.", color:"#a67c4a", image:"https://commons.wikimedia.org/wiki/Special:FilePath/Common_carp.jpg"},
    monni: {title:"Wels Catfish", mood:"Nocturnal giant of the depths", where:"Deep river bends, tailwaters below dams, deep holes in large lakes, and submerged timber.", when:"Warm summer nights are best. A pressure change after a thunderstorm often triggers activity.", start:"A large natural bait or the clonking technique, with sturdy tackle.", color:"#5a4a3a", image:"https://commons.wikimedia.org/wiki/Special:FilePath/Silurus_glanis_white2.JPG"},
    mustebassi: {title:"Black Bass", mood:"Ambush predator of the weed beds", where:"Weed edges, submerged timber, docks, and shaded drop-offs in warm lakes.", when:"Warm water from spring to autumn, best around dawn and dusk and on cloudy days.", start:"Soft plastic bait on a Texas rig or a topwater lure along weed edges.", color:"#3d5a3d", image:"https://commons.wikimedia.org/wiki/Special:FilePath/Largemouth_Bass_(Micropterus_salmoides).jpg"},
    barbo: {title:"Barbel", mood:"Current-loving bottom grazer", where:"Flowing rivers, tailwaters below dams, gravel bottoms, and slower current seams.", when:"Warm water from spring to autumn, especially at dusk and after rain when flow picks up.", start:"Earthworm or sweetcorn on a bottom rig, presented right on the riverbed.", color:"#b09468", image:"https://commons.wikimedia.org/wiki/Special:FilePath/Barbel.jpg"}
  }
};

const FISH_SEASONS_TRANS = {
  fi: {
    hauki: [
      {label:"Kevät", text:"Jäidenlähdön jälkeen hauki hakeutuu matalille, aurinkoisille lahdenpohjukoille kutemaan huhti-toukokuussa. Vesi on kylmää, joten viehettä kannattaa uittaa hitaasti - pieni vaappu tai matalalla kulkeva jerkkiviehe toimii parhaiten aurinkoisella ja tyynellä säällä, kun matala vesi lämpenee nopeimmin."},
      {label:"Kesä", text:"Helteellä hauki vetäytyy viileämpään veteen, kasvillisuuden suojaan tai syvempien pudotusten reunoille. Parhaat hetket ovat aamu- ja iltahämärä, jolloin pintaviehe tai matalalla kulkeva shad toimii. Tuulinen, pilvinen kesäpäivä pitää hauen aktiivisena myös keskipäivällä."},
      {label:"Syksy", text:"Veden viiletessä syys-lokakuussa hauki syö voimakkaasti valmistautuessaan talveen. Isot vaaput, lusikat ja spinnerbaitit tehoavat erityisesti tuulisella säällä, joka sekoittaa vettä ja tuo happea ja ravintokaloja rantavyöhykkeelle."},
      {label:"Talvi", text:"Jään alla hauki liikkuu hitaammin, mutta pysyy usein aktiivisena kasvillisuuden aukoissa ja syvänteiden reunoilla, varsinkin aamu- ja iltahämärässä. Pilkkikalastuksessa isompi, hitaasti liikuteltava viehe tai eläväsyötti toimii parhaiten, kun kirkas pakkaskeli vaihtuu lauhempaan."}
    ],
    kuha: [
      {label:"Kevät", text:"Kutuaikaan touko-kesäkuussa kuha liikkuu matalampiin, lämpimämpiin lahtiin. Kalastus onnistuu parhaiten iltahämärässä ja yöllä pienellä jigillä tai vaapulla, koska kylmä kevätvesi hidastaa kalan aineenvaihduntaa päivällä."},
      {label:"Kesä", text:"Lämmin kesävesi aktivoi kuhan, mutta kirkas päivänvalo painaa sen syvänteisiin tai sameaan veteen. Parhaat saalismahdollisuudet ovat pilvisellä säällä, iltahämärässä ja yöllä - jigi pohjan tuntumassa tai kuhan vaappu vetouistelussa."},
      {label:"Syksy", text:"Syksyllä kuha kokoontuu syvänteiden reunoille ja kovapohjaisille penkoille ravintokalojen perässä. Pystypilkintä veneestä ja hitaasti aukovat jigit toimivat hyvin, erityisesti tyyninä, pilvisinä päivinä."},
      {label:"Talvi", text:"Jään alla kuha viihtyy syvänteissä ja liikkuu hitaasti. Pilkki tai pieni tuulastin lähellä pohjaa, hidas nostoliike ja pitkät tauot - parhaat hetket ovat usein hämärän tunnit ja ilmanpaineen ollessa vakaa."}
    ],
    ahven: [
      {label:"Kevät", text:"Kutuaikaan huhti-toukokuussa ahvenparvet kokoontuvat matalille, kasvillisuuden reunustamille alueille. Pieni jigi tai lippa toimii hyvin lämpimimpään aikaan päivästä, kun aurinko on lämmittänyt matalan veden."},
      {label:"Kesä", text:"Kesällä ahven syö usein koko päivän, mutta parhaat piikit ovat aamulla ja illalla. Kevyt tuuli ja pieni pintakuohu auttavat peittämään vieheen liikkeen - mikrojigi, pieni lusikka tai dropshot toimivat laitureilla ja kivikoilla."},
      {label:"Syksy", text:"Syksyllä ahven parveutuu suuremmiksi joukoiksi ja seuraa pikkukalaparvia avoimilla penkoilla. Tuulinen, pilvinen päivä tuo kalan lähemmäs pintaa - kokeile pieniä vaappuja ja lusikoita."},
      {label:"Talvi", text:"Jään alla ahven liikkuu hitaammin mutta on usein hyvin tavoitettavissa syvänteiden reunoilta. Pieni pilkki tai vaappupilkki, hidas ja tasainen liike, toimii parhaiten aamu- ja iltahämärässä."}
    ],
    taimen: [
      {label:"Kevät", text:"Keväällä kylmä, hapekas vesi houkuttelee taimenta virran saumoihin ja niskoille. Kapea lusikka tai vaappu, uitettuna virran mukana, toimii parhaiten pilvisellä ja viileällä säällä."},
      {label:"Kesä", text:"Lämpimällä kesäsäällä taimen hakeutuu viileämpään, hapekkaaseen veteen - virtapaikkoihin, syvempiin suvantoihin tai ulkosaariston tuulen puolelle. Parhaat hetket ovat aamu- ja iltahämärä."},
      {label:"Syksy", text:"Syksyllä nousukalat liikkuvat jokisuille ja virtapaikkoihin. Pilvinen, tuulinen sää ja hämärän tunnit ovat parhaita - perho, pieni jigi tai kapea lusikka virran mukaan uitettuna."},
      {label:"Talvi", text:"Talvella taimen liikkuu hitaasti kylmässä vedessä, mutta avovesialueilla ja sulissa virtapaikoissa kalastus voi onnistua leudompina päivinä. Muista aina tarkistaa paikalliset rauhoitukset ja alamitat."}
    ],
    sarki: [
      {label:"Kevät", text:"Kutuaikaan touko-kesäkuussa särkikalat kokoontuvat matalille, kasvillisuuden reunustamille alueille syömään. Pieni koukku, mato tai toukka koho-ongella toimii hyvin lämpimänä, tyynenä päivänä."},
      {label:"Kesä", text:"Lämpimänä kesänä särkikalat viihtyvät lämpimissä lahdissa ja laitureilla koko päivän. Ruokinta kokoaa parven paikalleen - maissi, leipä tai toukka toimivat syöttinä tyynellä säällä."},
      {label:"Syksy", text:"Veden viiletessä särkikalat vetäytyvät syvemmälle, mutta lämpimät, aurinkoiset päivät voivat tuoda parven takaisin matalaan."},
      {label:"Talvi", text:"Talvella särkikalat liikkuvat hitaasti ja syövät vähän. Pilkkikalastuksessa pieni koukku ja hidas, herkkä vapa auttavat havaitsemaan aristelevat otit."}
    ],
    karppi: [
      {label:"Kevät", text:"Veden lämmetessä keväällä karppi aktivoituu ja hakeutuu matalille, aurinkoisille alueille. Esisyöttäminen ja kärsivällisyys kannattavat, kun vesi ylittää noin 12 astetta."},
      {label:"Kesä", text:"Lämmin kesävesi on karpin parasta aikaa - aamuyö ja ilta ovat tehokkaimpia hetkiä. Boili tai maissi hiuskoukussa syöttöpaikalla, joka on esisyötetty säännöllisesti."},
      {label:"Syksy", text:"Syksyllä karppi syö voimakkaasti valmistautuessaan talveen, ja ilmanpaineen lasku ennen ukkosta tai sadetta aktivoi kalaa entisestään."},
      {label:"Talvi", text:"Talvella karpin aineenvaihdunta hidastuu merkittävästi ja se syö harvoin. Kalastus onnistuu parhaiten leudoimpina päivinä syvemmissä talvehtimiskuopissa."}
    ],
    monni: [
      {label:"Kevät", text:"Alkukeväällä monni on vielä hidas kylmässä vedessä, mutta veden lämpenemisen myötä toukokuun lopulla se alkaa aktivoitua syvänteiden ja jokien mutkien tuntumassa."},
      {label:"Kesä", text:"Lämpimät kesäyöt ovat monnin parasta aikaa. Ukkosen jälkeinen ilmanpaineen muutos ja lämmin, tyyni yö saavat ison monnin liikkeelle - iso luonnonsyötti tai clonking-tekniikka toimii."},
      {label:"Syksy", text:"Syksyllä monni syö vielä aktiivisesti lämpimien päivien iltoina ennen kuin siirtyy talvehtimispaikkoihin syvänteisiin."},
      {label:"Talvi", text:"Talvella monni on lähes liikkumaton syvänteiden pohjalla ja kalastus on harvoin kannattavaa - paras aika palaa jälleen kevään lämpenemisen myötä."}
    ],
    mustebassi: [
      {label:"Kevät", text:"Veden lämpenemisen myötä keväällä mustebassi hakeutuu matalille kutupaikoille kasvillisuuden reunoille. Hidas soft plastic -syötti texas-riggauksella toimii hyvin."},
      {label:"Kesä", text:"Lämpimällä kesäsäällä mustebassi viihtyy varjoisilla pudotuksilla ja upotettujen puiden luona. Aamu- ja iltahämärä sekä pilvinen sää tuovat kalan lähemmäs pintaa - pintaviehe toimii tyynellä säällä."},
      {label:"Syksy", text:"Syksyllä mustebassi seuraa pikkukalaparvia avoimemmilla alueilla ennen siirtymistä talvehtimispaikkoihin syvemmälle."},
      {label:"Talvi", text:"Talvella mustebassi on hitaampi ja pysyttelee syvemmässä vedessä - hidas, pieni viehe lähellä pohjaa toimii parhaiten leudompina päivinä."}
    ],
    barbo: [
      {label:"Kevät", text:"Kevään tulviin ja kohonneeseen virtaamaan toutain reagoi aktiivisesti - mato tai maissi pohjasiimalla virran hidastumakohdissa toimii hyvin."},
      {label:"Kesä", text:"Lämpimällä kesäsäällä toutain syö parhaiten hämärän aikaan ja sateen jälkeen, kun virtaama kasvaa hetkellisesti."},
      {label:"Syksy", text:"Syksyllä toutain kerääntyy syvempiin virran hidastumakohtiin ja patojen alavesiin ennen talvea."},
      {label:"Talvi", text:"Talvella toutain on hidas ja viettää ajan syvimmissä virran suvantopaikoissa - kalastus on harvinaisempaa mutta mahdollista leudompina jaksoina."}
    ]
  },
  en: {
    hauki: [
      {label:"Spring", text:"After ice-out, pike moves onto shallow, sun-warmed bays to spawn in April-May. The water is still cold, so work lures slowly - a small wobbler or a shallow-running jerkbait works best on calm, sunny days when the shallows warm up fastest."},
      {label:"Summer", text:"In hot weather pike retreats to cooler water, weed cover, or the edges of deeper drop-offs. The best windows are dawn and dusk, when a topwater lure or a shallow-running shad works well. Windy, overcast summer days keep pike active even at midday."},
      {label:"Autumn", text:"As the water cools in September-October, pike feeds aggressively ahead of winter. Large spoons, wobblers, and spinnerbaits are effective, especially on windy days that mix the water and bring oxygen and baitfish to the shoreline."},
      {label:"Winter", text:"Under the ice, pike moves more slowly but often stays active near weed gaps and the edges of deep basins, especially at dawn and dusk. For ice fishing, a larger, slow-moving lure or live bait works best, particularly when a clear cold spell gives way to milder weather."}
    ],
    kuha: [
      {label:"Spring", text:"During the May-June spawning period, zander moves into shallower, warmer bays. Fishing works best at dusk and at night with a small jig or wobbler, since cold spring water slows the fish's metabolism during the day."},
      {label:"Summer", text:"Warm summer water activates zander, but bright daylight pushes it into deep water or turbid areas. The best chances come on cloudy days, at dusk, and at night - a jig worked near the bottom or a zander-style trolling lure."},
      {label:"Autumn", text:"In autumn, zander gathers along deep edges and hard-bottomed ridges, following baitfish. Vertical jigging from a boat and slow-worked soft plastics do well, especially on calm, overcast days."},
      {label:"Winter", text:"Under the ice, zander stays in deep basins and moves slowly. A jig or small lure fished close to the bottom with a slow lift and long pauses works best, often during twilight hours and when air pressure is stable."}
    ],
    ahven: [
      {label:"Spring", text:"During the April-May spawning period, perch schools gather in shallow areas lined with vegetation. A small jig or spinner works well during the warmest part of the day, once the sun has warmed the shallows."},
      {label:"Summer", text:"In summer, perch often feeds all day, but the strongest bites come in the morning and evening. A light breeze and a bit of surface chop help mask lure movement - micro jigs, small spoons, and drop-shot rigs work well around docks and rocky shoals."},
      {label:"Autumn", text:"In autumn, perch forms larger schools and follows baitfish shoals in open areas. A windy, overcast day brings the fish closer to the surface - try small wobblers and spoons."},
      {label:"Winter", text:"Under the ice, perch moves more slowly but is often easy to find along the edges of deep basins. A small ice jig or wobbler with a slow, steady motion works best at dawn and dusk."}
    ],
    taimen: [
      {label:"Spring", text:"In spring, cold, oxygen-rich water draws trout to current seams and the heads of rapids. A slender spoon or wobbler worked with the current works best on overcast, cool days."},
      {label:"Summer", text:"In hot summer weather, trout seeks cooler, oxygenated water - current areas, deeper pools, or the windward side of the outer archipelago. The best windows are dawn and dusk."},
      {label:"Autumn", text:"In autumn, migrating fish move into river mouths and current areas. Overcast, windy weather and twilight hours are best - a fly, small jig, or slender spoon fished with the current."},
      {label:"Winter", text:"In winter, trout moves slowly in cold water, but open-water areas and unfrozen current spots can still produce fish on milder days. Always check local closed seasons and minimum size limits."}
    ],
    sarki: [
      {label:"Spring", text:"During the May-June spawning period, roach schools gather in shallow, weed-lined areas to feed. A small hook with a worm or maggot on a float rig works well on warm, calm days."},
      {label:"Summer", text:"In warm summer weather, roach favor warm bays and docks throughout the day. Groundbaiting keeps the school in place - sweetcorn, bread, or maggot work well as bait in calm conditions."},
      {label:"Autumn", text:"As the water cools, roach retreat to deeper water, though warm, sunny days can still draw the school back into the shallows."},
      {label:"Winter", text:"In winter, roach moves slowly and feeds sparingly. Ice fishing calls for a small hook and a sensitive, slow presentation to detect cautious bites."}
    ],
    karppi: [
      {label:"Spring", text:"As the water warms in spring, carp becomes active and moves into shallow, sunlit areas. Pre-baiting and patience pay off once the water passes roughly 12°C."},
      {label:"Summer", text:"Warm summer water is carp's prime season - early morning and evening are the most productive windows. A boilie or sweetcorn on a hair rig at a regularly pre-baited swim works well."},
      {label:"Autumn", text:"In autumn, carp feeds heavily ahead of winter, and a pressure drop before a thunderstorm or rain often triggers extra activity."},
      {label:"Winter", text:"In winter, carp's metabolism slows drastically and it feeds rarely. Fishing works best on the mildest days in deeper wintering holes."}
    ],
    monni: [
      {label:"Spring", text:"In early spring, catfish is still sluggish in cold water, but as the water warms toward the end of May it starts becoming active near deep holes and river bends."},
      {label:"Summer", text:"Warm summer nights are catfish's prime time. A pressure change after a thunderstorm combined with a warm, calm night brings big catfish on the move - a large natural bait or the clonking technique works well."},
      {label:"Autumn", text:"In autumn, catfish still feeds actively on warm evenings before moving to deep wintering spots."},
      {label:"Winter", text:"In winter, catfish is nearly motionless on the bottom of deep holes and fishing is rarely worthwhile - the best time returns with spring warming."}
    ],
    mustebassi: [
      {label:"Spring", text:"As the water warms in spring, black bass moves onto shallow spawning areas along weed edges. A slow soft-plastic bait on a Texas rig works well."},
      {label:"Summer", text:"In warm summer weather, black bass favors shaded drop-offs and submerged timber. Dawn, dusk, and cloudy weather bring fish closer to the surface - a topwater lure works well in calm conditions."},
      {label:"Autumn", text:"In autumn, black bass follows baitfish shoals into more open areas before moving to deeper wintering spots."},
      {label:"Winter", text:"In winter, black bass slows down and stays in deeper water - a slow, small lure fished near the bottom works best on milder days."}
    ],
    barbo: [
      {label:"Spring", text:"Barbel responds actively to spring floods and rising flow - a worm or sweetcorn on a bottom rig in slower current seams works well."},
      {label:"Summer", text:"In warm summer weather, barbel feeds best at dusk and after rain, when the flow briefly picks up."},
      {label:"Autumn", text:"In autumn, barbel gathers in deeper, slower current areas and tailwaters below dams ahead of winter."},
      {label:"Winter", text:"In winter, barbel is sluggish and spends its time in the deepest, slowest current pools - fishing is less common but possible during milder spells."}
    ]
  }
};

const TIPS_TRANS = {
  fi: [
    {tag:"Pakkaa mukaan", title:"Peruspaketti rannalle", desc:"Monipuolinen rasia syntyy muutamasta lusikasta, vaapusta, lipasta, jigistä, perukkeista, pihdeistä ja mittanauhasta."},
    {tag:"Solmut", title:"Harjoittele kaksi solmua", desc:"Viehesolmu ja perukkeen liitos riittävät useimpiin tilanteisiin. Testaa solmu aina vetämällä ennen ensimmäistä heittoa.", links:[{label:"Viehesolmu", url:"https://www.youtube.com/results?search_query=viehesolmu+kalastus"},{label:"Perukkeen liitos", url:"https://www.youtube.com/results?search_query=perukkeen+liitos+kalastus"}]},
    {tag:"Turvallisuus", title:"Vesillä ensin järki", desc:"Pelastusliivit, sääennuste, varavirta puhelimelle ja pimeällä otsalamppu ovat halvempia kuin huono yllätys."},
    {tag:"Lukeminen", title:"Katso tuulen puoli", desc:"Tuuli työntää ravintoa rannoille ja karikoille. Kokeile ensin tuulen pieksemää reunaa, sitten suojaisampaa kohtaa."},
    {tag:"Rytmi", title:"Vaihda vain yhtä asiaa", desc:"Jos ei tärppää, vaihda ensin nopeutta, sitten syvyyttä ja vasta lopuksi väriä. Näin opit, mikä oikeasti vaikutti."},
    {tag:"Vastuullisuus", title:"Mittaa, vapauta, ota kohtuudella", desc:"Tarkista alamitat, rauhoitukset ja paikalliset rajoitukset. Isot emokalat kannattaa usein päästää jatkamaan sukua."}
  ],
  en: [
    {tag:"Pack Wisely", title:"Basic Tackle Box", desc:"A versatile setup consists of a few spoons, wobblers, spinners, soft jigs, wire leaders, pliers, and a tape measure."},
    {tag:"Knots", title:"Master Two Knots", desc:"The improved clinch knot and a leader connection knot are all you need. Always test your knot with a firm pull before casting.", links:[{label:"Clinch Knot", url:"https://www.youtube.com/results?search_query=clinch+knot+fishing"},{label:"Leader Connection", url:"https://www.youtube.com/results?search_query=leader+knot+fishing"}]},
    {tag:"Safety", title:"Common Sense First", desc:"Life jacket, weather forecast, power bank for your phone, and a headlamp for dark hours are much cheaper than a bad surprise."},
    {tag:"Reading", title:"Check Wind Direction", desc:"Wind pushes baitfish and nutrients towards banks and shoals. Try the windward side first, then look for sheltered spots."},
    {tag:"Rhythm", title:"Change One Thing", desc:"If there are no bites, change retrieve speed first, then depth, and color last. This way you learn what actually triggered the strike."},
    {tag:"Ethics", title:"Measure, Release, Conserve", desc:"Check size limits, closed seasons, and local restrictions. Returning large breeding females keeps the fishery healthy."}
  ]
};

const GEAR_PROMO_TRANS = {
  fi: {
    heading: "Suositellut varusteet",
    disclosure: "Mainos · kaupallinen yhteistyö Scandinavian Outdoorin kanssa",
    items: [
      {tag:"Sääsuoja", title:"Rab Downpour Trail LGT -kuoritakki", desc:"Kun kelimittari näyttää tuulista tai sateista keliä, kuivana pysyminen ratkaisee koko reissun. Kevyt kuorikerros mahtuu aina reppuun.", url:"https://scandinavianoutdoor.fi/rab/vaatteet/takit/vedenpitavat-kuoritakit/downpour-trail-lgt-jkt/?currency=EUR&delivery_country=FI&select-color=anthracite&utm_source=adtraction&utm_medium=affiliate&utm_campaign=adtraction&at_gd=209BFF1A940204E4F61CDA5C9962446D74405511&size=l", label:"Katso kuoritakki"},
      {tag:"Hämärä", title:"Led Lenser HF6R Core -otsalamppu", desc:"Parhaat syöntihetket osuvat usein hämärään aamuun tai iltaan. Kädet vapaana valaiseva otsalamppu on silloin korvaamaton.", url:"https://scandinavianoutdoor.fi/led-lenser/varusteet/valaisimet/otsalamput/ledlens-hf6r-core/?currency=EUR&delivery_country=FI&utm_source=adtraction&utm_medium=affiliate&utm_campaign=adtraction&at_gd=209BFF1A940204E4F61CDA5C9962446D74405511&color=musta", label:"Katso otsalamppu"},
      {tag:"Turvallisuus", title:"Ursuit Slimline Pro Auto 175N -pelastusliivi", desc:"Veneestä tai laiturilta kalastaessa pelastusliivi on halvin henkivakuutus, mitä voit ostaa.", url:"https://scandinavianoutdoor.fi/ursuit/varusteet/pelastusliivit/slimline-pro-auto-175n/?utm_source=adtraction&utm_medium=affiliate&utm_campaign=adtraction&at_gd=209BFF1A940204E4F61CDA5C9962446D74405511", label:"Katso pelastusliivi"},
      {tag:"Reissueväät", title:"Sigg Miracle Mug 0,27L -termosmuki", desc:"Pitkä kalapäivä rannalla tai jäällä sujuu paremmin, kun kahvi pysyy kuumana ja eväät tallessa.", url:"https://scandinavianoutdoor.fi/sigg/varusteet/ruokailu-ja-astiat/astiat/027-miracle-mug/?currency=EUR&delivery_country=FI&utm_source=adtraction&utm_medium=affiliate&utm_campaign=adtraction&at_gd=209BFF1A940204E4F61CDA5C9962446D74405511&color=musta", label:"Katso termosmuki"},
      {tag:"Talvikalastus", title:"Lundhags Grip Ice Claw STD -jäänaskalit", desc:"Pilkkijän ja jäällä liikkuvan ehdoton turvavaruste – parantaa mahdollisuuksia päästä takaisin jään päälle, jos pinta pettää.", url:"https://scandinavianoutdoor.fi/lundhags/talvilajit/talviretkeily/retkiluistelu/grip-ice-claw-std/?utm_source=adtraction&utm_medium=affiliate&utm_campaign=adtraction&at_gd=209BFF1A940204E4F61CDA5C9962446D74405511", label:"Katso jäänaskalit"},
      {tag:"Paikannus", title:"Garmin eTrex Touch -käsi-GPS", desc:"Muista tarkka kalapaikka reissusta toiseen ja löydä takaisin rantaan pimeälläkin.", url:"https://scandinavianoutdoor.fi/garmin/varusteet/gps-ja-kompassit/kasi-gps-ja-kartat/eterx-touch/?utm_source=adtraction&utm_medium=affiliate&utm_campaign=adtraction&at_gd=209BFF1A940204E4F61CDA5C9962446D74405511", label:"Katso GPS-laite"}
    ]
  },
  en: {
    heading: "Recommended gear",
    disclosure: "Ad · commercial partnership with Scandinavian Outdoor",
    items: [
      {tag:"Weather protection", title:"Rab Downpour Trail LGT shell jacket", desc:"When the bite index shows wind or rain, staying dry decides the whole trip. A light shell always fits in the pack.", url:"https://scandinavianoutdoor.fi/rab/vaatteet/takit/vedenpitavat-kuoritakit/downpour-trail-lgt-jkt/?currency=EUR&delivery_country=FI&select-color=anthracite&utm_source=adtraction&utm_medium=affiliate&utm_campaign=adtraction&at_gd=209BFF1A940204E4F61CDA5C9962446D74405511&size=l", label:"See shell jacket"},
      {tag:"Twilight", title:"Led Lenser HF6R Core headlamp", desc:"The best bite windows often land at dusk or dawn. A hands-free headlamp is irreplaceable then.", url:"https://scandinavianoutdoor.fi/led-lenser/varusteet/valaisimet/otsalamput/ledlens-hf6r-core/?currency=EUR&delivery_country=FI&utm_source=adtraction&utm_medium=affiliate&utm_campaign=adtraction&at_gd=209BFF1A940204E4F61CDA5C9962446D74405511&color=musta", label:"See headlamp"},
      {tag:"Safety", title:"Ursuit Slimline Pro Auto 175N life jacket", desc:"Fishing from a boat or dock, a life jacket is the cheapest life insurance you can buy.", url:"https://scandinavianoutdoor.fi/ursuit/varusteet/pelastusliivit/slimline-pro-auto-175n/?utm_source=adtraction&utm_medium=affiliate&utm_campaign=adtraction&at_gd=209BFF1A940204E4F61CDA5C9962446D74405511", label:"See life jacket"},
      {tag:"Trail food", title:"Sigg Miracle Mug 0.27L", desc:"A long day on the shore or ice goes better when your coffee stays hot and your food stays put.", url:"https://scandinavianoutdoor.fi/sigg/varusteet/ruokailu-ja-astiat/astiat/027-miracle-mug/?currency=EUR&delivery_country=FI&utm_source=adtraction&utm_medium=affiliate&utm_campaign=adtraction&at_gd=209BFF1A940204E4F61CDA5C9962446D74405511&color=musta", label:"See mug"},
      {tag:"Ice fishing", title:"Lundhags Grip Ice Claw STD ice picks", desc:"An essential safety item for anglers and anyone on the ice - improves your chances of getting back up if the ice gives way.", url:"https://scandinavianoutdoor.fi/lundhags/talvilajit/talviretkeily/retkiluistelu/grip-ice-claw-std/?utm_source=adtraction&utm_medium=affiliate&utm_campaign=adtraction&at_gd=209BFF1A940204E4F61CDA5C9962446D74405511", label:"See ice picks"},
      {tag:"Navigation", title:"Garmin eTrex Touch handheld GPS", desc:"Remember the exact spot from trip to trip and find your way back to shore even after dark.", url:"https://scandinavianoutdoor.fi/garmin/varusteet/gps-ja-kompassit/kasi-gps-ja-kartat/eterx-touch/?utm_source=adtraction&utm_medium=affiliate&utm_campaign=adtraction&at_gd=209BFF1A940204E4F61CDA5C9962446D74405511", label:"See GPS device"}
    ]
  }
};

const LINKS_TRANS = {
  fi: [
    {tag:"Viralliset", title:"Luvat ja rajoitukset", desc:"Tarkista kalastonhoitomaksu, aluekohtaiset luvat ja rauhoitusalueet ennen reissua.", links:[{label:"Eräluvat", url:"https://www.eraluvat.fi/kalastus"},{label:"Kalastusrajoitus.fi", url:"https://kalastusrajoitus.fi/"}]},
    {tag:"Sää", title:"Sää ja tuuli", desc:"Kelimittari käyttää Open-Meteoa, mutta reissulle kannattaa tarkistaa myös sadetutka ja tuuliennuste.", links:[{label:"Ilmatieteen laitos", url:"https://www.ilmatieteenlaitos.fi/saa"},{label:"Yr", url:"https://www.yr.no/"}]},
    {tag:"Kartat", title:"Paikan etsiminen", desc:"Syvänteet, karikot, salmet ja kasvillisuusrajat ovat usein parempia kuin satunnainen suora ranta.", links:[{label:"Karttapaikka", url:"https://asiointi.maanmittauslaitos.fi/karttapaikka/"},{label:"Retkikartta", url:"https://www.retkikartta.fi/"}]}
  ],
  en: [
    {tag:"Official", title:"Licenses & Closed Areas", desc:"Check the national fisheries management fee, local permits, and restricted zones before your trip.", links:[{label:"Metsähallitus Permits", url:"https://www.eraluvat.fi/en/fishing.html"},{label:"Fishing Restrictions Map", url:"https://kalastusrajoitus.fi/"}]},
    {tag:"Weather", title:"Weather & Wind", desc:"The bite index uses Open-Meteo, but you should also check rain radars and local marine forecasts before heading out.", links:[{label:"Finnish Met Institute", url:"https://en.ilmatieteenlaitos.fi/"},{label:"Yr.no", url:"https://www.yr.no/en"}]},
    {tag:"Maps", title:"Spot Finding", desc:"Deep trenches, reefs, channels, and weed lines are usually much better than an average uniform shore.", links:[{label:"Maanmittauslaitos Map", url:"https://asiointi.maanmittauslaitos.fi/karttapaikka/?lang=en"},{label:"Retkikartta Outdoors", url:"https://www.retkikartta.fi/?lang=en"}]}
  ]
};

const CONSENT_TRANS = {
  fi: {
    text: `Sivusto käyttää evästeitä (mainosten personointiin Google AdSense) ja pyytää tarvittaessa selaimesi GPS-sijaintia näyttääkseen lähelläsi olevat kalakelit. Sijaintitietojasi käsitellään vain selaimessasi eikä niitä tallenneta palvelimelle. Lue lisää <a href="tietosuoja.html" target="_blank">tietosuojaselosteesta</a>.`,
    decline: "Hylkää valinnaiset",
    accept: "Hyväksy kaikki"
  },
  en: {
    text: `This site uses cookies (for Google AdSense ad personalization) and requests your browser's GPS location if needed to show local bite forecasts. Your location data is processed entirely locally on your device and is never stored on a server. Read more in our <a href="tietosuoja.html" target="_blank">Privacy Policy</a>.`,
    decline: "Decline Optional",
    accept: "Accept All"
  }
};

let currentLang = storage.getItem('user_language') || 'fi';
let SPECIES = SPECIES_TRANS[currentLang];
let LURES = LURES_TRANS[currentLang];
let FISH_INFO = FISH_INFO_TRANS[currentLang];
let FISH_SEASONS = FISH_SEASONS_TRANS[currentLang];
let lastInfo = null;
let lastWeatherData = null;
let lastDailySummaries = null;
let lastSpeciesForDaily = null;
let lastLocForDaily = null;
let selectedDayKey = null;

function renderTips() {
  const tips = TIPS_TRANS[currentLang];
  const grid = document.getElementById("tipsGrid");
  if (!grid) return;
  grid.innerHTML = tips.map(t => {
    let linksHtml = "";
    if (t.links) {
      linksHtml = `<div class="card-links" style="margin-top:12px; display:flex; gap:12px; font-size:0.85rem;">` + 
        t.links.map(l => `<a href="${l.url}" target="_blank" rel="noopener" class="mini-link" style="color:var(--orange-dark); font-weight:bold; text-decoration:underline;">${l.label} ↗</a>`).join("") + 
        `</div>`;
    }
    return `<article class="tip-card">
      <span class="tag">${t.tag}</span>
      <h3>${t.title}</h3>
      <p>${t.desc}</p>
      ${linksHtml}
    </article>`;
  }).join("");
}

function renderLinks() {
  const links = LINKS_TRANS[currentLang];
  const grid = document.getElementById("linksGrid");
  if (!grid) return;
  grid.innerHTML = links.map(t => {
    let linksHtml = "";
    if (t.links) {
      linksHtml = `<div class="card-links" style="margin-top:12px; display:flex; gap:12px; flex-wrap:wrap; font-size:0.85rem;">` + 
        t.links.map(l => `<a href="${l.url}" target="_blank" rel="noopener" class="btn secondary" style="font-size:0.8rem; padding:6px 12px;">${l.label} ↗</a>`).join("") + 
        `</div>`;
    }
    return `<article class="tip-card">
      <span class="tag">${t.tag}</span>
      <h3>${t.title}</h3>
      <p>${t.desc}</p>
      ${linksHtml}
    </article>`;
  }).join("");
}

function renderGearPromo() {
  const promo = GEAR_PROMO_TRANS[currentLang];
  const headingEl = document.getElementById("gearPromoHeading");
  const disclosureEl = document.getElementById("gearPromoDisclosure");
  const grid = document.getElementById("gearPromoGrid");
  if (!grid) return;
  if (headingEl) headingEl.textContent = promo.heading;
  if (disclosureEl) disclosureEl.textContent = promo.disclosure;
  grid.innerHTML = promo.items.map(t => {
    return `<article class="tip-card gear-promo-card">
      <span class="tag">${t.tag}</span>
      <h3>${t.title}</h3>
      <p>${t.desc}</p>
      <div class="card-links" style="margin-top:12px;">
        <a href="${t.url}" target="_blank" rel="noopener sponsored" class="btn primary" style="font-size:0.8rem; padding:8px 14px;">${t.label} ↗</a>
      </div>
    </article>`;
  }).join("");
}

// AdSense-skripti ladataan nyt suoraan <head>:ssä heti sivun latautuessa (katso head-osio),
// jotta Googlen tarkistusrobotti löytää mainoskoodin sivulta myös silloin kun evästeitä
// ei ole vielä hyväksytty. Consent Mode v2 -signaalit (ks. head) huolehtivat siitä, että
// mainokset pysyvät ei-personoituina kunnes käyttäjä hyväksyy mainosevästeet.
let adsenseLoaded = true;
function loadAdSense() {
  // Ei-op: skripti on jo ladattu <head>:ssä sivun latautuessa. Funktio on säilytetty
  // yhteensopivuuden vuoksi, jotta muu koodi voi turvallisesti kutsua sitä.
}

function clearLegacyConsentState() {
  try { storage.removeItem('cookie_consent'); } catch(e) {}
  try { document.cookie = 'cookie_consent=; Max-Age=0; path=/; SameSite=Lax'; } catch(e) {}
}

function renderConsentBanner() {
  // Mainos- ja analytiikkasuostumus kuuluu nyt Google-certified CMP:lle. Vanha FastFishing-banneri
  // poistetaan myös DOM:sta, jotta Googlen European regulations -viestin päälle ei tule toista dialogia.
  document.getElementById("consentBanner")?.remove();
  clearLegacyConsentState();
}

function openGooglePrivacyChoices() {
  window.googlefc = window.googlefc || {};
  window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
  const showChoices = () => {
    if (typeof window.googlefc.showRevocationMessage !== 'function') return false;
    window.googlefc.showRevocationMessage();
    return true;
  };
  if (showChoices()) return;
  window.googlefc.callbackQueue.push({ CONSENT_API_READY: showChoices });
}

function setLanguage(lang, saveToLocalStorage = true) {
  currentLang = lang;
  if (saveToLocalStorage) {
    storage.setItem('user_language', lang);
  }
  
  SPECIES = getSpeciesForCountry(lang, detectedCountryCode);
  LURES = LURES_TRANS[lang];
  FISH_INFO = FISH_INFO_TRANS[lang];
  FISH_SEASONS = FISH_SEASONS_TRANS[lang];
  
  // Re-initialize select elements
  const currentFishId = spSel.value;
  spSel.innerHTML = "";
  SPECIES.forEach(s => spSel.add(new Option(s.name, s.id)));
  if (currentFishId) spSel.value = currentFishId;
  
  const trans = UI_TRANS[lang];
  document.title = trans.title;
  
  // Update nav buttons
  const tabMap = {
    "kelimittari": trans.tab_kelimittari,
    "uistimet": trans.tab_uistimet,
    "kalalajit": trans.tab_kalalajit,
    "varusteet": trans.tab_varusteet,
    "merikartta": trans.tab_merikartta,
    "oppaat": trans.tab_oppaat,
    "linkit": trans.tab_linkit
  };
  document.querySelectorAll(".tab-btn").forEach(btn => {
    const pageId = btn.dataset.page;
    if (tabMap[pageId]) btn.textContent = tabMap[pageId];
  });
  
  // Hero translation
  const heroEyebrow = document.querySelector(".hero .eyebrow");
  if (heroEyebrow) heroEyebrow.textContent = trans.hero_eyebrow;
  const heroLead = document.querySelector(".hero .lead");
  if (heroLead) heroLead.textContent = trans.hero_lead;
  const heroBtnCheck = document.querySelector(".hero .btn[data-go='kelimittari']");
  if (heroBtnCheck) heroBtnCheck.textContent = trans.hero_btn_check;
  const heroBtnLure = document.querySelector(".hero .btn[data-go='uistimet']");
  if (heroBtnLure) heroBtnLure.textContent = trans.hero_btn_lure;
  
  // Panel translation
  const panelTitle = document.querySelector(".hero-panel .panel-title strong");
  if (panelTitle) panelTitle.textContent = trans.panel_title;
  const panelPill = document.querySelector(".hero-panel .panel-title .pill");
  if (panelPill) panelPill.textContent = trans.panel_pill;
  
  const labelSearch = document.querySelector("label[for='locationSearch']");
  if (labelSearch) labelSearch.textContent = trans.label_search;
  const searchHint = document.getElementById('locationSearchHint');
  if (searchHint) searchHint.textContent = trans.placeholder_search;
  
  const labelSelected = document.querySelector("label[for='locationSelect']");
  if (labelSelected) labelSelected.textContent = trans.label_selected;
  const labelSpecies = document.querySelector("label[for='speciesSelect']");
  if (labelSpecies) labelSpecies.textContent = trans.label_species;
  
  const btnRefresh = document.getElementById("refreshBtn");
  if (btnRefresh) btnRefresh.textContent = trans.btn_refresh;
  
  // Page headers
  const pageHeaderMap = {
    "kelimittari": { h2: trans.page_kelimittari_title, p: trans.page_kelimittari_desc },
    "uistimet": { h2: trans.page_uistimet_title, p: trans.page_uistimet_desc },
    "kalalajit": { h2: trans.page_kalalajit_title, p: trans.page_kalalajit_desc },
    "varusteet": { h2: trans.page_varusteet_title, p: trans.page_varusteet_desc },
    "merikartta": { h2: trans.page_merikartta_title, p: trans.page_merikartta_desc },
    "oppaat": { h2: trans.page_oppaat_title, p: trans.page_oppaat_desc },
    "linkit": { h2: trans.page_linkit_title, p: trans.page_linkit_desc }
  };
  Object.keys(pageHeaderMap).forEach(pageId => {
    const pageSection = document.getElementById(pageId);
    if (pageSection) {
      const h2 = pageSection.querySelector(".section-head h2");
      if (h2) h2.textContent = pageHeaderMap[pageId].h2;
      const p = pageSection.querySelector(".section-head p");
      if (p) p.textContent = pageHeaderMap[pageId].p;
    }
  });
  
  // Lure rules header
  const lureRulesSection = document.getElementById("lureRulesHead");
  if (lureRulesSection) {
    const h2 = lureRulesSection.querySelector("h2");
    if (h2) h2.textContent = trans.lure_rules_title;
    const p = lureRulesSection.querySelector("p");
    if (p) p.textContent = trans.lure_rules_desc;
  }

  const realLureTitle = document.getElementById("realLureTitle");
  if (realLureTitle) realLureTitle.textContent = trans.real_lure_title;
  const realLureDesc = document.getElementById("realLureDesc");
  if (realLureDesc) realLureDesc.textContent = trans.real_lure_desc;
  const waterVariantsTitle = document.getElementById("waterVariantsTitle");
  if (waterVariantsTitle) waterVariantsTitle.textContent = trans.water_variants_title;
  const fishSeasonsTitle = document.getElementById("fishSeasonsTitle");
  if (fishSeasonsTitle) fishSeasonsTitle.textContent = trans.fish_seasons_title;
  const fishSeasonsDesc = document.getElementById("fishSeasonsDesc");
  if (fishSeasonsDesc) fishSeasonsDesc.textContent = trans.fish_seasons_desc;
  const waterVariantsDesc = document.getElementById("waterVariantsDesc");
  if (waterVariantsDesc) waterVariantsDesc.textContent = trans.water_variants_desc;
  const lureBackBtn = document.getElementById("lureBackBtn");
  if (lureBackBtn) lureBackBtn.textContent = trans.lure_back;

  // Manual form
  const labelPD = document.querySelector("label[for='mPressureDelta']");
  if (labelPD) labelPD.textContent = trans.label_pressure_delta;
  const labelWind = document.querySelector("label[for='mWind']");
  if (labelWind) labelWind.textContent = trans.label_wind;
  const labelTemp = document.querySelector("label[for='mTemp']");
  if (labelTemp) labelTemp.textContent = trans.label_temp;
  const labelCloud = document.querySelector("label[for='mCloud']");
  if (labelCloud) {
    const cloudVal = document.getElementById("mCloudVal")?.textContent || "50";
    labelCloud.innerHTML = `${trans.label_cloud} <span id="mCloudVal">${cloudVal}</span>%`;
  }
  const labelPrime = document.querySelector(".checkline-label");
  if (labelPrime) labelPrime.textContent = trans.label_prime;
  const mCalcBtn = document.getElementById("mCalcBtn");
  if (mCalcBtn) mCalcBtn.textContent = trans.btn_manual_calc;

  const dailyForecastTitle = document.getElementById("dailyForecastTitle");
  if (dailyForecastTitle) dailyForecastTitle.textContent = trans.daily_forecast_title;
  const dailyForecastSub = document.getElementById("dailyForecastSub");
  if (dailyForecastSub) dailyForecastSub.textContent = trans.daily_forecast_sub;
  if (lastDailySummaries) renderDailyForecast(lastDailySummaries, selectedDayKey);

  // Nearby section header
  const nearbyTitle = document.querySelector("#nearbySection h2");
  if (nearbyTitle) nearbyTitle.textContent = trans.nearby_title;
  const nearbyWaterNote = document.getElementById("nearbyWaterNote");
  if (nearbyWaterNote) {
    nearbyWaterNote.textContent = lang === 'fi'
      ? "Kalalajit ja vesityyppi ovat yleistä arviota paikan nimen perusteella. Nimetyt kalapaikat suurimmilla kaupunkiseuduilla ovat oikeasti tunnettuja, julkisilta kalastussivustoilta koottuja paikkoja - ei taattu tulos, mutta oikea lähtökohta."
      : "Fish species and water type are a general estimate based on the place name. Named fishing spots for major cities are real, known locations gathered from public fishing sites - not a guaranteed catch, but a genuine starting point.";
  }
  // Päivitetään jo renderöityjen korttien vesistötiedot uudelle kielelle
  renderNearbySpots.lastSpots && renderNearbySpots(renderNearbySpots.lastSpots, renderNearbySpots.lastLat, renderNearbySpots.lastLon);
  if (!renderNearbySpots.lastSpots && document.getElementById('nearbyLocationBtn')) renderGeoLocationOptIn();
  updatePotentialSpotLanguage();
  
  // Footer
  const footerShell = document.querySelector("footer .shell");
  if (footerShell) {
    const changeViewLabel = lang === 'fi' ? 'Vaihda laitenäkymää' : 'Switch device view';
    const changeConsentLabel = lang === 'fi' ? 'Tietosuoja- ja evästeasetukset' : 'Privacy & cookie settings';
    footerShell.innerHTML = `${trans.footer_text} <a href="tietosuoja.html" style="color:inherit; text-decoration:underline;">${trans.footer_privacy}</a> · <a href="tietoa-meista.html" style="color:inherit; text-decoration:underline;">${trans.footer_about}</a> · <button id="switchDeviceViewBtn" style="background:none; border:none; color:inherit; text-decoration:underline; font-weight:bold; cursor:pointer; padding:0; font-size:inherit; font-family:inherit;">${changeViewLabel}</button> · <button id="changeConsentBtn" style="background:none; border:none; color:inherit; text-decoration:underline; font-weight:bold; cursor:pointer; padding:0; font-size:inherit; font-family:inherit;">${changeConsentLabel}</button>`;
    
    const btnSwitch = document.getElementById("switchDeviceViewBtn");
    if (btnSwitch) {
      btnSwitch.addEventListener("click", (e) => {
        e.preventDefault();
        storage.removeItem('device_view');
        renderDeviceSelector();
      });
    }

    const btnConsent = document.getElementById("changeConsentBtn");
    if (btnConsent) {
      btnConsent.addEventListener("click", (e) => {
        e.preventDefault();
        openGooglePrivacyChoices();
      });
    }
  }

  // Update mobile bottom nav labels if they exist
  document.querySelectorAll(".mobile-nav-item").forEach(btn => {
    const pageId = btn.dataset.page;
    const labelSpan = btn.querySelector(".m-nav-label");
    if (labelSpan && tabMap[pageId]) {
      labelSpan.textContent = tabMap[pageId];
    }
  });
  
  // Update dynamic location labels if they are "Oma sijaintisi" or "Your Location"
  Object.keys(DYNAMIC_LOCATIONS).forEach(key => {
    const l = DYNAMIC_LOCATIONS[key];
    if (l.name === "Oma sijaintisi" || l.name === "Your Location") {
      l.name = lang === 'fi' ? "Oma sijaintisi" : "Your Location";
      const opt = locSel.querySelector(`option[value="${key}"]`);
      if (opt) opt.text = l.name;
    }
  });
  
  // Update language selector buttons active state
  document.querySelectorAll(".lang-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.lang === lang);
  });
  
  // Redraw lists
  renderRules();
  renderTips();
  renderLinks();
  renderGearPromo();
  renderFishInfo(spSel.value);
  renderDetailFishInfo(spSel.value);
  
  // Update consent banner language
  renderConsentBanner(lang);
  
  // Trigger update
  refresh();
}

// Bind language switching buttons
document.querySelectorAll(".lang-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    setLanguage(btn.dataset.lang);
  });
});

const locSel = document.getElementById("locationSelect");
const spSel = document.getElementById("speciesSelect");
const searchInput = document.getElementById("locationSearch");
const locCountEl = document.getElementById("locationCount");

// Sijainnit, jotka eivät ole valmislistalla (esim. suoraan GPS-koordinaateista)
const DYNAMIC_LOCATIONS = {};
function resolveLocation(key){
  if (Object.prototype.hasOwnProperty.call(DYNAMIC_LOCATIONS, key)) return DYNAMIC_LOCATIONS[key];
  return LOCATIONS[key];
}
function addDynamicLocation(loc){
  const key = `geo:${loc.lat.toFixed(4)},${loc.lon.toFixed(4)}`;
  DYNAMIC_LOCATIONS[key] = loc;
  if (!locSel.querySelector(`option[value="${key}"]`)) {
    locSel.add(new Option(loc.name, key), 0);
  }
  return key;
}

// Initialize Selects
function initSelects() {
  locSel.innerHTML = "";
  LOCATIONS.forEach((l,i) => locSel.add(new Option(l.name, i)));
  spSel.innerHTML = "";
  SPECIES.forEach(s => spSel.add(new Option(s.name, s.id)));
  
  // Etsitään Naantali oletukseksi, jos löytyy
  const defaultIdx = LOCATIONS.findIndex(l => l.name.includes("Naantali"));
  if (defaultIdx !== -1) locSel.value = defaultIdx;
}
initSelects();

// Hakukentän logiikka
let worldSearchTimeout = null;
let worldSearchController = null;

searchInput.addEventListener("input", (e) => {
  const rawTerm = e.target.value;
  const term = rawTerm.toLowerCase();
  locSel.innerHTML = "";
  let matchFound = false;
  let count = 0;

  LOCATIONS.forEach((l, i) => {
    if (l.name.toLowerCase().includes(term)) {
      locSel.add(new Option(l.name, i)); // Käytetään alkuperäistä indeksiä (i), jotta refresh() löytää datan
      count++;
      if (!matchFound) {
        locSel.value = i;
        matchFound = true;
      }
    }
  });

  clearTimeout(worldSearchTimeout);
  if (worldSearchController) worldSearchController.abort();

  if (term === "") {
    LOCATIONS.forEach((l, i) => locSel.add(new Option(l.name, i)));
    locCountEl.textContent = "";
    return;
  }

  const foundLabel = currentLang === 'fi' ? `Löytyi ${count} paikkaa` : `Found ${count} places`;
  const searchingLabel = currentLang === 'fi' ? "Haetaan myös maailmalta..." : "Also searching worldwide...";
  locCountEl.textContent = count > 0 ? foundLabel : searchingLabel;

  // Kun paikallinen valmislista ei riitä (tai osumia on vähän), täydennetään haku
  // maailmanlaajuisella geokoodauksella samaa Nominatim-palvelua käyttäen kuin GPS-haku.
  if (rawTerm.trim().length >= 3) {
    worldSearchTimeout = setTimeout(() => searchWorldwide(rawTerm.trim(), term, count), 500);
  }
});

async function searchWorldwide(rawTerm, term, localCount) {
  worldSearchController = new AbortController();
  const timeoutId = setTimeout(() => worldSearchController.abort(), 7000);
  try {
    const lang = currentLang === 'fi' ? 'fi' : 'en';
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(rawTerm)}&limit=8&accept-language=${lang}`;
    const res = await fetch(url, {signal: worldSearchController.signal, headers:{"Accept":"application/json"}});
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error("world search failed");
    const data = await res.json();

    // Jos käyttäjä ehti kirjoittaa lisää, hylätään vanhentunut vastaus
    if (searchInput.value.trim() !== rawTerm) return;

    let added = 0;
    let firstKey = null;
    (Array.isArray(data) ? data : []).forEach(place => {
      const lat = parseFloat(place.lat), lon = parseFloat(place.lon);
      if (isNaN(lat) || isNaN(lon)) return;
      const label = (place.display_name || "").split(",").slice(0, 3).join(",").trim();
      if (!label) return;
      const key = addDynamicLocation({name: label, lat, lon});
      if (firstKey === null) firstKey = key;
      added++;
    });

    if (localCount === 0 && firstKey !== null) locSel.value = firstKey;

    const foundLabel = currentLang === 'fi' ? `Löytyi ${localCount} paikkaa` : `Found ${localCount} places`;
    const worldLabel = added > 0
      ? (currentLang === 'fi' ? `+ ${added} tulosta maailmalta` : `+ ${added} worldwide results`)
      : (currentLang === 'fi' ? "Ei tuloksia maailmaltakaan" : "No worldwide results either");
    locCountEl.textContent = localCount > 0 ? `${foundLabel} · ${worldLabel}` : worldLabel;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') return;
    if (localCount === 0) {
      locCountEl.textContent = currentLang === 'fi' ? "Ei tuloksia" : "No results";
    }
  }
}


function haversineKm(lat1,lon1,lat2,lon2){
  const R=6371, toRad=d=>d*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}
function offsetCoord(lat,lon,distanceKm,bearingDeg){
  const R=6371, brng=bearingDeg*Math.PI/180;
  const lat1=lat*Math.PI/180, lon1=lon*Math.PI/180;
  const lat2=Math.asin(Math.sin(lat1)*Math.cos(distanceKm/R)+Math.cos(lat1)*Math.sin(distanceKm/R)*Math.cos(brng));
  const lon2=lon1+Math.atan2(Math.sin(brng)*Math.sin(distanceKm/R)*Math.cos(lat1),Math.cos(distanceKm/R)-Math.sin(lat1)*Math.sin(lat2));
  return {lat:lat2*180/Math.PI, lon:((lon2*180/Math.PI+540)%360)-180};
}
function bearingLabel(deg){
  const dirs = currentLang === 'fi'
    ? ["pohjoiseen","koilliseen","itään","kaakkoon","etelään","lounaaseen","länteen","luoteeseen"]
    : ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  return dirs[Math.round(((deg%360)+360)%360/45)%8];
}
async function fetchWeatherBatch(locs){
  const lats=locs.map(l=>l.lat).join(","), lons=locs.map(l=>l.lon).join(",");
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&hourly=temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,cloud_cover&daily=sunrise,sunset&past_days=1&forecast_days=2&timezone=auto&wind_speed_unit=ms`;
  const controller=new AbortController();
  const timeoutId=setTimeout(()=>controller.abort(),9000);
  try{
    const res=await fetch(url,{signal:controller.signal});
    clearTimeout(timeoutId);
    if(!res.ok) throw new Error("Sään haku epäonnistui");
    const json=await res.json();
    return Array.isArray(json)?json:[json];
  }catch(err){clearTimeout(timeoutId);throw err}
}
async function reverseGeocode(lat,lon){
  const controller=new AbortController();
  const timeoutId=setTimeout(()=>controller.abort(),5000);
  try{
    const url=`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=13&accept-language=fi`;
    const res=await fetch(url,{signal:controller.signal,headers:{"Accept":"application/json"}});
    clearTimeout(timeoutId);
    if(!res.ok) return null;
    const data=await res.json();
    const a=data.address||{};
    return a.village||a.town||a.city||a.municipality||a.hamlet||a.suburb||a.county||data.name||null;
  }catch(err){clearTimeout(timeoutId);return null}
}
const NEARBY_SHOW_COUNT=6;

// Karkea vesistötyypin päättely paikan nimestä (ei paikkakohtaista dataa,
// vaan yleistä tietoa vesityypin mukaan) + tyypilliset kalalajit sille tyypille.
// Nimessä esiintyvät koskiset, kylmävetiset joet/reitit joissa harjuskannat ovat tunnettuja
// (Koillismaa, Lappi, Kainuun/Pohjois-Karjalan koskireitit). Muut joet luokitellaan
// eteläisemmiksi/loivemmiksi joiksi, joissa harjusta ei yleensä tavata (esim. Aurajoki).
const COLD_RIVER_KEYWORDS = [
  "kuusamo","oulanka","kuusinki","ivalo","ivalojoki","näätämö","juutua","tornionjoki",
  "muonionjoki","ounasjoki","kemijoki","kemijärvi","iijoki","koitajoki","emäjoki",
  "kolari","kittilä","muonio","enontekiö","inari","utsjoki","kilpisjärvi"
];
function classifyWaterType(name){
  const n = name.toLowerCase();
  if (n.includes("meri") || n.includes("saaristo") || n.includes("selkämeri") || n.includes("suomenlahti") || n.includes("pohjanlahti")) return "sea";
  if (n.includes("joki") || n.includes("koski") || n.includes("reitti")) {
    return COLD_RIVER_KEYWORDS.some(k => n.includes(k)) ? "river_north" : "river_south";
  }
  return "lake";
}
const WATER_TYPE_INFO = {
  sea: {
    fi: {label:"Merialue / rannikko", species:"ahven, hauki, kuha, meritaimen, siika, silakka, kampela", tip:"Kokeile luotojen, saarten ja syvänteiden reunoja."},
    en: {label:"Sea / coastal area", species:"perch, pike, zander, sea trout, whitefish, herring, flounder", tip:"Try edges of skerries, islands and deeper channels."}
  },
  river_north: {
    fi: {label:"Koskinen jokialue (pohjoinen)", species:"taimen, harjus, siika, ahven, hauki, made", tip:"Kokeile koskien niskoja, virran murroskohtia ja kuoppia harjuskaloille."},
    en: {label:"Rapids / northern river", species:"trout, grayling, whitefish, perch, pike, burbot", tip:"Try the heads of rapids, current breaks and pools for grayling."}
  },
  river_south: {
    fi: {label:"Joki / virtavesi (eteläinen)", species:"ahven, hauki, kuha, made, säyne, lahna", tip:"Harjusta ei yleensä tavata näillä loivemmilla joilla - kokeile sen sijaan syvänteitä ja virran hidastumakohtia. Jokisuulla myös meritaimen mahdollinen nousuaikaan."},
    en: {label:"River / stream (southern)", species:"perch, pike, zander, burbot, ide, bream", tip:"Grayling is rarely found in these gentler rivers - try deeper pools and slower current instead. Near river mouths, sea trout is possible during runs."}
  },
  lake: {
    fi: {label:"Järvi", species:"ahven, hauki, kuha, made, siika, muikku", tip:"Kokeile pudotuksia, kasvillisuuden reunoja ja saarten liepeitä."},
    en: {label:"Lake", species:"perch, pike, zander, burbot, whitefish, vendace", tip:"Try drop-offs, weed edges and around islands."}
  }
};
// Nimettyjä, oikeasti tunnettuja kalapaikkoja suurimmille kaupunkiseuduille - koottu julkisilta
// kalastussivustoilta (mm. kalastajankanava.fi, vapaa-ajankalastajalehti.fi, kaupunkien omat
// kalastussivut, kalastus.com-keskustelut). Näitä EI ole GPS-mitattu paikan päällä, joten niillä
// ei ole omaa lat/lon-koordinaattia tässä - ne näytetään nimettyinä paikkoina sen kaupungin/järven
// kortilla johon ne kuuluvat, ei tarkkana pisteenä kartalla. Tarkoituksella suppea lista täsmällisiä,
// löydettävissä olevia paikkoja - ei arvattuja "mahdollisia" kivikkoja joita ei voi vahvistaa.
const CITY_FISHING_SPOTS = {
  "Helsinki - Suomenlahti": [
    {name:"Vanhankaupunginkoski ja -suvanto", note:"Pääkaupunkiseudun tunnetuin kalapaikka - taimenta, lohta ja jopa kuusikiloisia toutaimia, rannat rakennettu myös lasten ja liikkumisesteisten kalastukseen."},
    {name:"Vanhankaupunginlahti", note:"Suojaisa lintuvesilahti, hauki liikkeellä jo jäiden lähdön jälkeen keväällä."},
    {name:"Lauttasaaren silta", note:"Tunnettu silakka- ja särkipaikka, myös ahventa."},
    {name:"Vantaanjoen suu", note:"Hauki nousee suulle heti keväällä jäiden lähdettyä."},
    {name:"Laajalahti", note:"Kaislikkoinen, suojainen lahti - hauki ja ahven."}
  ],
  "Turku - Aurajoki / Saaristomeri": [
    {name:"Aurajoki, keskusta", note:"Kuhaa ja ahventa aivan kaupungin ytimessä, parhaiten kesäiltaisin ja -öisin jigaamalla."},
    {name:"Hahdenniemi", note:"Ahventa ja kuhaa erityisesti syksyllä, kalastus onnistuu aallonmurtajalta ja uimarannan laiturilta."},
    {name:"Ruissalo", note:"Meritaimenta ja siikaa rannalta keväällä ja syksyllä."},
    {name:"Halistenkoski", note:"Alaosa ja loppuliuku suosittuja virtapaikkoja."}
  ],
  "Tampere - Näsijärvi / Pyhäjärvi": [
    {name:"Rajasalmi (Pyhäjärvi)", note:"Tunnettu haukipaikka, salmi virtaa kahden selän välillä."},
    {name:"Pyynikin saaret (Pyhäjärvi)", note:"Isoja haukia, myös istutettuja taimenia rannan tuntumassa."},
    {name:"Kierimonsalmi ja Aniansalmi (Pyhäjärvi)", note:"Kapeikkoja, joissa hauki väijyy virtausta."},
    {name:"Iidesjärvi ja Tohloppijärvi", note:"Pienempiä kaupunkijärviä rantakalastukseen, hyviä aloittelijalle."}
  ],
  "Jyväskylä - Päijänne": [
    {name:"Jyväsjärvi, Lutakon satama", note:"Kaupungin tunnetuin lähikalastuspaikka - ahventa, haukea, kuhaa ja särkeä laiturilta ilman erillistä lupaa."},
    {name:"Ristikivi ja Nenäinniemi (Päijänne)", note:"Heittopaikkoja Päijänteen rannassa."},
    {name:"Iso-Haapasaari (Päijänne)", note:"Kuhaa rannalta jigaamalla."},
    {name:"Köhniönjärvi", note:"Vain rantakalastus sallittu, paljon kiiskeä ja haukea."}
  ],
  "Kuopio - Kallavesi": [
    {name:"Etelä-Kallaveden saaristo", note:"Matalikkoja, kapeikkoja ja penkkoja - kuhaa ja haukea."},
    {name:"Valkeisenlampi ja Väinölänniemi", note:"Aivan keskustan tuntumassa, hyviä lähikalastuspaikkoja."}
  ],
  "Vaasa - Merenkurkku": [
    {name:"Räätälinsaari", note:"Tunnettu kalapaikka, kulku Vaskiluodon Vankilanrannasta."},
    {name:"Hovioikeudenallas", note:"Satama-alue ja rautatiesillan alla virtaava veneväylä - ahventa ja haukea."},
    {name:"Kalaranta", note:"Pitkä kiinteä kalastuslaituri Eteläisen kaupunginselän eteläpäässä."},
    {name:"Onkilahti", note:"Esteetön kalastuslaituri."}
  ],
  "Oulu - Perämeri / Oulujoki": [
    {name:"Oulujoen suu, Merikosken alakanava", note:"Kuuluisa lohipaikka, myös harjusta ja siikaa."},
    {name:"Hartaanselkä", note:"Alueen suositelluin heittokalastuspaikka."},
    {name:"Toppilansalmi", note:"Hyvä onkimispaikka."},
    {name:"Kuivasjärvi", note:"Suosittu ahvenen pilkintäjärvi talvella."}
  ],
  "Rovaniemi - Kemijoki": [
    {name:"Tikkasenkari (Kemijoki)", note:"Suositeltu, luotettava kalastuspaikka."},
    {name:"Vanttauskoski ja Hirvas-Muurola (Kemijoki)", note:"Toimivia koskialueita."},
    {name:"Ounasjoki", note:"Harjus on joen tunnuskala, myös taimenta ja isoja haukia rauhallisemmissa osissa."}
  ],
  "Lahti - Vesijärvi": [
    {name:"Joutjoen suisto", note:"Hyvät mahdollisuudet rantaongintaan."},
    {name:"Enonsaaren ja Karjusaaren välinen syvänne", note:"Matalampi syvänne saarten välissä, kuhaa ja haukea."}
  ],
  "Kotka - Kymijoki / meri": [
    {name:"Mansikkalahti", note:"Hyvä paikka rannalta kohti Varissaarta."},
    {name:"Kantasatama ja Keisarinsatama", note:"Haukipaikkoja aivan kaupungin tuntumassa."},
    {name:"Kymijoen Siikakoski ja Korkeakoski", note:"Tunnettuja lohi- ja taimenkoskia."}
  ],
  "Hamina - Itäinen Suomenlahti": [
    {name:"Nakatappi", note:"Paikallisten mielestä alueen paras kalapaikka."},
    {name:"Mullinkoski ja Salmenvirta", note:"Virtapaikkoja, joissa hauki liikkuu lähes koko rantaviivalla."}
  ],
  "Joensuu - Pyhäselkä": [
    {name:"Pyhäselän rannat", note:"Toimii sekä heittäen että kohoa käyttäen."},
    {name:"Pielisjoki, kaupungin läpi virtaava osuus", note:"Suojainen paikka, kalastettavissa lähes säällä kuin säällä."}
  ],
  "Pori - Kokemäenjoki": [
    {name:"Keskustan siltojen väli", note:"Pitkä hyvä ranta, josta nousee myös meritaimenta."},
    {name:"Pälpälänlahti", note:"Ahventa ja haukea, ajoittain myös taimenta."}
  ],
  "Lappeenranta - Saimaa": [
    {name:"Suur-Saimaan lahdet kaupungin edustalla", note:"Hyviä heitto- ja jigipaikkoja hauelle, ahvenelle ja kuhalle."},
    {name:"Kuivaketvele", note:"Kapea, virtaava salmi - vahva ahven- ja kuhakanta."}
  ],
  "Mikkeli - Saimaa": [
    {name:"Mikkelin edustan Saimaan lahdet", note:"Monipuolista järvikalastusta hauelle, ahvenelle, kuhalle ja saimaannieriälle."}
  ],
  "Espoo - Laajalahti": [
    {name:"Pitkäjärvi, Bodominjärvi ja Lippajärvi", note:"Suosittuja rantakalastusjärviä ahvenelle ja hauelle."},
    {name:"Mankinjoen suu", note:"Isoja haukia joen suulla."},
    {name:"Ruoholahden kanava", note:"Kaupunkiympäristö tuottaa yllättävän isoja ahvenia ja kuhia."},
    {name:"Suvisaariston Suinonsalmi ja Otaniemi", note:"Merenrannan heittopaikkoja."}
  ],
  "Hämeenlinna - Vanajavesi": [
    {name:"Niittykadun kalastuslaituri", note:"Esteetön kaupungin kalastuslaituri Vanajaveden rannalla."},
    {name:"Vanajanselkä", note:"Laaja lupa-alue, toimii hyvin myös pilkkivetenä."},
    {name:"Kernaala", note:"Kuhaa on saatu vuosittain hyvin."}
  ],
  "Kokkola - Perämeri": [
    {name:"Laajalahti", note:"Haukea rannasta, riutta alkaa jo muutaman metrin päästä rannasta."},
    {name:"Öjan saaristo", note:"Hyvä alue, painottuu veneestä kalastukseen."},
    {name:"Sunti", note:"Rantakalastukseen sopiva haukipaikka."}
  ],
  "Savonlinna - Pihlajavesi": [
    {name:"Haapasalmi", note:"Aivan torin kupeessa, virvelöintiin ja soutu-uisteluun oma lupa-alue."},
    {name:"Kyrönsalmi (Olavinlinnan ympäristö)", note:"Virtaa Olavinlinnan ohi, hyvä heittopaikka."},
    {name:"Laitaatsalmi", note:"Kaupungin länsipuolella."}
  ],
  "Imatra - Vuoksi": [
    {name:"Vuoksi", note:"Syvä, voimakkaasti virtaava jokialue - taimenta, harjusta, siikaa, lohta, kuhaa ja haukea ympäri vuoden."},
    {name:"Immalanjärvi", note:"Järvikalastusvaihtoehto Vuoksen rinnalla."}
  ],
  "Sotkamo - Nuasjärvi": [
    {name:"Jormasjoki", note:"Alueen tunnetuin koskikalastuspaikka, helposti saavutettavissa Kajaani-Sotkamo-tieltä."},
    {name:"Nuasjärven Konnanlahti-Rantakylä", note:"Sekä ranta-alue että lahti ovat tuottavia."},
    {name:"Laakajärvi", note:"Hyvä taimenpaikka uistellen ja verkolla."}
  ],
  "Paltamo - Oulujärvi": [
    {name:"Hirsiselkä (Ristijärven ja Paltamon raja)", note:"Suositeltu alue Oulujärven pohjoisosassa."}
  ],
  "Rauma - Selkämeri": [
    {name:"Kaupungin keskustan läpi virtaava joki", note:"Isoja ahvenia ja haukia jigaten, ajoittain meritaimenta."},
    {name:"Säikänsuntti", note:"Kapea salmi - ahventa, haukea ja keväällä siikaa."},
    {name:"Mustalahti", note:"Haukea ja ahventa."}
  ],
  "Porvoo - Porvoonjoki": [
    {name:"Porvoonjoki", note:"Kalastettavissa läpi kaupungin."},
    {name:"Hamarin satama", note:"Lähtöpaikka Porvoon saaristoon suuntautuville kalareissuille."},
    {name:"Sipoon ja Porvoon merialue", note:"Yksi Suomenlahden vilkkaimmista vapaa-ajankalastusalueista - hyvä hauki- ja ahvenkanta."}
  ],
  "Kouvola - Kymijoki": [
    {name:"Langinkoski ja Pernoonkoski (Kymijoki)", note:"Kymijoen tunnetuimpia koskia, suosittuja lohi- ja taimenpaikkoja."},
    {name:"Puolakankoski (Verla)", note:"Lupa-alue perhokalastukseen, heittoon ja vetouisteluun - istutettua taimenta ja luontaista haukea."}
  ],
  "Inari - Inarijärvi": [
    {name:"Inarijärvi", note:"Lapin tunnetuimpia kalavesiä - haukea, ahventa ja muikkua veneestä tai oppaan kanssa, syvyys- ja matalikkoreunat parhaita."},
    {name:"Iijärvi (Kaldoaivin erämaan reunalla)", note:"Tunnettu erityisesti harjuksesta."}
  ],
  "Nokia - Pyhäjärvi": [
    {name:"Pyhäjärvi", note:"Yksi Suomen parhaista kuhavesistä."}
  ],
  "Valkeakoski - Vanajavesi": [
    {name:"Vanaja- ja Mallasvesi", note:"Onnistuu jopa kävelysiltojen ympärillä keskustassa."},
    {name:"Lotilanjärvi", note:"Toinen suosittu paikallinen kalastuskohde."}
  ],
  "Varkaus - Haukivesi / Unnukka": [
    {name:"Kinkamonselkä (Puurtila)", note:"Hyvä alue, samoin koko Unnukka."},
    {name:"Haukivesi", note:"Laaja selkä Varkauden alapuolella - lähes kaikkia sisävesikaloja."}
  ],
  "Hanko - Hangon merialue": [
    {name:"Hankoniemen pohjoispuolinen saaristo", note:"Suojaisa saaristo, paras alue hauelle."}
  ],
  "Kirkkonummi - Porkkala": [
    {name:"Porkkalanniemen kärki", note:"Oikeaan aikaan kohtuullisen hyvä meritaimenpaikka."}
  ],
  "Salo - Halikonlahti": [
    {name:"Latokartanonkoski", note:"Kunnostettu lohikalojen kutupaikka."}
  ],
  "Kemi - Perämeri": [
    {name:"Kemin sisäsatama", note:"Rauhallinen heittopaikka aivan kaupungissa."},
    {name:"Kemin edustan vapaa virkistyskalastusalue", note:"Suomen ensimmäinen laatuaan - kalastus onnistuu pelkällä kalastonhoitomaksulla."}
  ],
  "Raahe - Perämeri": [
    {name:"Kuljunlahti", note:"Pysyy sulana talvellakin - isoa ahventa, haukea ja lahnaa."},
    {name:"Raahen saaristo", note:"Hyvä ahvenenpilkkipaikka talvella."}
  ],
  "Mustasaari - Merenkurkku": [
    {name:"Raippaluodon silta", note:"Suomen pisimmän sillan ympäristö - erinomainen pilkkipaikka, myös hauen ja ahvenen heittokalastusta sekä silakan litkaamista."}
  ],
  "Jämsä - Päijänne": [
    {name:"Tiirinselkä ja Pohjois-Päijänne", note:"Jämsän edustan suosituimmat kalapaikat - haukea, ahventa, kuhaa ja istutettua järvitaimenta."},
    {name:"Jämsänjoki", note:"Kaupungin läpi virtaava joki, monipuolista kalastusta."}
  ],
  "Naantali - Saaristomeri": [
    {name:"Naantalinaukko", note:"Laaja selkävesi - hyvä hauki- ja ahvenkanta."},
    {name:"Kolkannokka (Ruissalo)", note:"Yksi Saaristomeren vilkkaimmista kuhapaikoista keväisin."},
    {name:"Ukkopekan silta", note:"Haukea ja kuoretta."},
    {name:"Merimaskun salmet", note:"Kapeat, virtaavat salmet - hyviä jigauspaikkoja."}
  ],
  "Parikkala - Simpelejärvi": [
    {name:"Simpelejärvi", note:"Vahva hauki-, ahven- ja kuhakanta, paljon hyviä kalapaikkoja ympäri järveä."}
  ],
  "Kitee - Puruvesi": [
    {name:"Puruvesi", note:"Tunnettu pilkkijärvi, hyvä ahvenkanta ja muikkukannan myötä myös isoa ajoahventa."}
  ],
  "Pudasjärvi - Iijoki": [
    {name:"Iijoen koskikalastusalue (yläosa)", note:"20 kilometrin pituinen koskijakso - harjusta ja taimenta läpi vuoden, parhaimmillaan elo-lokakuussa."},
    {name:"Tuulijärvi, Kivarinjärvi ja Keskijärvi", note:"Järvivaihtoehtoja koskikalastuksen rinnalle."}
  ]
};
function renderCitySpots(name){
  const spots = CITY_FISHING_SPOTS[name];
  const heading = currentLang === 'fi' ? '🎣 Tunnettuja kalapaikkoja' : '🎣 Known fishing spots';
  if (!spots || !spots.length) {
    const empty = currentLang === 'fi'
      ? 'Valitettavasti tältä alueelta ei ole vielä koottu nimettyjä kalapaikkoja - lisäämme niitä sitä mukaa kun löydämme luotettavia lähteitä.'
      : "We haven't gathered any named fishing spots for this area yet - we'll add them as we find reliable sources.";
    return `<div class="spot-known spot-known-empty"><strong>${heading}</strong><p>${empty}</p></div>`;
  }
  const items = spots.map(s => `<li><strong>${s.name}</strong> — ${s.note}</li>`).join('');
  return `<div class="spot-known"><strong>${heading}</strong><ul>${items}</ul></div>`;
}
function renderWaterInfo(name){
  const type = classifyWaterType(name);
  const info = WATER_TYPE_INFO[type][currentLang === 'fi' ? 'fi' : 'en'];
  const speciesLabel = currentLang === 'fi' ? 'Yleisimmät lajit' : 'Common species';
  return `<div class="spot-water">
    <span class="tag wtype-tag">${info.label}</span>
    <div><strong>${speciesLabel}:</strong> ${info.species}</div>
    <div>${info.tip}</div>
  </div>`;
}

// Suomalaiset vesistönimet kertovat kirjaimellisesti muodon: "-selkä" on avoin allas,
// "-lahti" suojainen poukama, "-salmi" kahden altaan välinen kapeikko, "koski" virtaava
// koskiosuus. Tämä EI ole arvaus yksittäisestä kalapaikasta jollekin tietylle järvelle - se on
// nimen itsensä jo kertoma tosiasia vesistön muodosta, johon sovelletaan yleistä, vakiintunutta
// tietoa siitä millainen rakenne houkuttelee haukea, ahventa ja kuhaa. Siksi tämä toimii kaikille
// 279 paikalle riippumatta siitä onko CITY_FISHING_SPOTS-listalla erikseen tutkittuja nimettyjä
// paikkoja vai ei - ja siksi se näytetään omana, selvästi erillisenä osionaan.
function classifyStructureHints(name){
  const water = (name.split(' - ')[1] || name).toLowerCase();
  const tokens = water.split(/[\/,()]| ja /).map(t => t.trim()).filter(Boolean);
  const rules = [
    { test: /selkä|selka/, hint: 'Nimen "-selkä" tarkoittaa avointa allasta. Etsi pohjan muodonvaihteluita eli penkkoja ja syvänteen reunoja - kuha ja hauki liikkuvat usein juuri niiden tuntumassa.' },
    { test: /lahti/, hint: 'Nimen "-lahti" tarkoittaa suojaista poukamaa. Kaislikko- ja kasvillisuusreunat lämpenevät keväällä nopeasti ja houkuttelevat sekä haukea että ahventa.' },
    { test: /salmi/, hint: 'Nimen "-salmi" tarkoittaa kahden altaan välistä kapeikkoa, jossa vesi virtaa. Klassinen väijyntäpaikka sekä hauelle että kuhalle.' },
    { test: /koski/, hint: 'Nimen "koski" tarkoittaa virtaavaa koskiosuutta. Niska ja hännän suvanto ovat tyypillisesti parhaita ahvenelle ja hauelle.' },
    { test: /vesi$|järvi$/, hint: 'Järviallas - saarten ja niemenkärkien liepeet sekä kivikkoiset rannat ovat tyypillisesti hyviä kuhan ja ahvenen kokoontumispaikkoja, kaislikkoiset lahdenpohjukat taas haukea suosivia väijyntäpaikkoja.' }
  ];
  const seen = new Set();
  const hints = [];
  for (const token of tokens) {
    for (const rule of rules) {
      if (rule.test.test(token) && !seen.has(rule.hint)) {
        seen.add(rule.hint);
        hints.push(rule.hint);
      }
    }
  }
  return hints;
}
function renderStructureHints(name){
  const hints = classifyStructureHints(name);
  if (!hints.length) return '';
  const heading = currentLang === 'fi' ? '🔍 Havaintoja vesistön rakenteesta' : '🔍 Structural observations';
  const items = hints.map(h => `<li>${h}</li>`).join('');
  return `<div class="spot-structure"><strong>${heading}</strong><ul>${items}</ul></div>`;
}

function renderNearbyError(msg){
  document.getElementById("nearbyStatus").textContent=msg;
  document.getElementById("nearbyGrid").innerHTML="";
  const wrap=document.getElementById("nearbyMapWrap");
  if (wrap) wrap.classList.add("is-empty");
}
function fmtKm(km){ return km<1?"< 1 km":`${Math.round(km)} km`; }
function useNearbySpot(s){
  const key=addDynamicLocation({name:s.name, lat:s.lat, lon:s.lon});
  locSel.value=key;
  refresh();
  showPage("kelimittari");
}
let nearbyMap=null, nearbyMarkers=[];
let leafletLoadPromise=null;
const MAP_ANALYSIS_SCRIPTS = [
  '/fishing-structures.js?v=13',
  '/depth-structures.js?v=13',
  '/gtk-substrate.js?v=13',
  '/gtk-habitats.js?v=13',
  '/velmu-fish.js?v=13',
];
let mapAnalysisLoadPromise=null;

function loadOptionalScript(src){
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=src;
    script.async=false;
    script.onload=resolve;
    script.onerror=()=>reject(new Error(`Valinnaisen kartta-aineiston lataus epäonnistui: ${src}`));
    document.head.appendChild(script);
  });
}

function ensureMapAnalysisModules(){
  if (mapAnalysisLoadPromise) return mapAnalysisLoadPromise;
  mapAnalysisLoadPromise=MAP_ANALYSIS_SCRIPTS.reduce(
    (pending,src)=>pending.then(()=>loadOptionalScript(src)),
    Promise.resolve()
  ).catch(error=>{
    mapAnalysisLoadPromise=null;
    throw error;
  });
  return mapAnalysisLoadPromise;
}

function ensureLeaflet(){
  if (typeof L!=="undefined") return Promise.resolve();
  if (leafletLoadPromise) return leafletLoadPromise;
  leafletLoadPromise=new Promise((resolve,reject)=>{
    const css=document.createElement("link");
    css.rel="stylesheet";
    css.href="/vendor/leaflet/leaflet.css";
    document.head.appendChild(css);
    const script=document.createElement("script");
    script.src="/vendor/leaflet/leaflet.js";
    script.onload=()=>resolve();
    script.onerror=reject;
    document.head.appendChild(script);
  });
  return leafletLoadPromise;
}
function renderNearbyMap(spots, userLat, userLon){
  const wrap=document.getElementById("nearbyMapWrap");
  const mapEl=document.getElementById("nearbyMap");
  if(!wrap || !mapEl) return;
  if (typeof L==="undefined"){
    ensureLeaflet().then(()=>renderNearbyMap(spots, userLat, userLon)).catch(()=>{});
    return;
  }
  wrap.classList.remove("is-empty");

  if(!nearbyMap){
    nearbyMap=L.map(mapEl,{scrollWheelZoom:false});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:18,
      attribution:'&copy; OpenStreetMap-tekijät'
    }).addTo(nearbyMap);
  }

  nearbyMarkers.forEach(m=>nearbyMap.removeLayer(m));
  nearbyMarkers=[];

  const useBtn = currentLang === 'fi' ? 'Käytä tätä paikkaa' : 'Use this spot';
  const meLabel = currentLang === 'fi' ? 'Oma sijaintisi' : 'Your location';
  const bounds=[];

  if (typeof userLat==="number" && typeof userLon==="number") {
    const meIcon=L.divIcon({className:"", html:`<div class="nearby-marker me"></div>`, iconSize:[20,20], iconAnchor:[10,10]});
    const meMarker=L.marker([userLat,userLon],{icon:meIcon}).addTo(nearbyMap);
    meMarker.bindPopup(`<div class="nearby-popup"><h4>${meLabel}</h4></div>`);
    nearbyMarkers.push(meMarker);
    bounds.push([userLat,userLon]);
  }

  spots.forEach((s,i)=>{
    if (s.distance===0) return; // sama piste kuin oma sijainti, ei kaksoismerkkiä
    const lbl=scoreLabel(s.score);
    const icon=L.divIcon({
      className:"",
      html:`<div class="nearby-marker" style="background:${lbl.color}"><span>${s.score}</span></div>`,
      iconSize:[34,34],
      iconAnchor:[17,30]
    });
    const marker=L.marker([s.lat,s.lon],{icon}).addTo(nearbyMap);
    const popupHtml=`<div class="nearby-popup"><h4>${s.name}</h4><p>${fmtKm(s.distance)} · ${lbl.text} (${s.score}/100)</p><button class="btn primary" id="popupUse${i}">${useBtn}</button></div>`;
    marker.bindPopup(popupHtml);
    marker.on("popupopen",()=>{
      const btn=document.getElementById(`popupUse${i}`);
      if (btn) btn.addEventListener("click",()=>useNearbySpot(s));
    });
    nearbyMarkers.push(marker);
    bounds.push([s.lat,s.lon]);
  });

  if (bounds.length) {
    nearbyMap.fitBounds(bounds,{padding:[38,38], maxZoom:12});
  }
  setTimeout(()=>{ if (nearbyMap) nearbyMap.invalidateSize(); },200);
}

let seaChartMap=null, seaChartSeamarkLayer=null;
function renderSeaChart(){
  const mapEl=document.getElementById("seaChartMap");
  if(!mapEl) return;
  if (typeof L==="undefined"){
    ensureLeaflet().then(renderSeaChart).catch(()=>{});
    return;
  }
  if (seaChartMap) {
    setTimeout(()=>seaChartMap.invalidateSize(),50);
    return;
  }

  // Zoomaus hiiren rullalla ja kahden sormen nipistyksellä (touchZoom on Leafletissä oletuksena
  // päällä) - ei erillisiä +/- -painikkeita, käyttäjän toiveen mukaisesti. Kartta luodaan
  // aluksi ei-vuorovaikutteisena (dragging/zoom pois päältä) - käyttäjän pitää ensin avata
  // kartta suureksi "Avaa kartta suureksi" -painikkeesta ennen kuin sitä voi käyttää.
  seaChartMap=L.map(mapEl,{
    scrollWheelZoom:false, zoomControl:false, dragging:false,
    touchZoom:false, doubleClickZoom:false, boxZoom:false, keyboard:false
  }).setView([64.2,26.0],6);
  // Avaimeton OpenStreetMap-karttapohja. CARTO-rasterilaatat vaativat nykyisin API-avaimen
  // ja näyttävät ilman sitä kartan päällä "API key required" -vesileiman.
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:18,
    attribution:'&copy; OpenStreetMap-tekijät',
    className:'sea-chart-basemap'
  }).addTo(seaChartMap);

  // OpenSeaMap on vapaaehtoisvoimin ylläpidetty avoin merimerkkidata - ei virallinen
  // navigointikartta eikä taattu SLA, siksi kerros on aina valinnainen eikä sitä ladata
  // pohjakartan estäväksi riippuvuudeksi. EI lisätä kartalle oletuksena: se piirtää samat
  // turvalaitteet toisilla ikoneilla kuin oma "Väylät ja karikot" -taso (turvalaitteet_uusi),
  // mikä teki kartasta sekavan kahden päällekkäisen merkkijoukon kanssa - käyttäjä saa
  // päälle halutessaan.
  seaChartSeamarkLayer=L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',{
    maxZoom:18,
    attribution:'&copy; OpenSeaMap-tekijät'
  });

  officialLayerGroup=L.layerGroup().addTo(seaChartMap);
  potentialSpotLayerGroup=L.layerGroup().addTo(seaChartMap);
  seaChartMap.on('moveend zoomend', updateOfficialLayers);
  seaChartMap.on('moveend zoomend', schedulePotentialSpotUpdate);
  seaChartMap.on('moveend', updateSeaChartWeather);
  updateOfficialLayers();
  updateSeaChartWeather();
  const potentialToggle=document.getElementById('potentialSpotsToggle');
  if (potentialToggle && potentialToggle.checked) togglePotentialSpots(true);

  // Kaappausvaiheen kuuntelija (capture:true) tarvitaan, koska Leaflet pysäyttää klikkauksen
  // etenemisen karttatasolle jos käyttäjä klikkaa suoraan väylän/merkin/alueen päälle - ilman
  // tätä reitin lähtö-/määränpää-asetus ei toiminut kun kartalla oli paljon kerroksia päällekkäin.
  // stopPropagation on välttämätön: muuten sama klikkaus etenisi kuplavaiheessa myös alla
  // olevan merkin omaan popup-avaukseen, joka voi panoroida karttaa ja laukaista
  // virallisten kerrosten päivityksen kesken oman avautumisanimaationsa (kaatava race condition).
  seaChartMap.getContainer().addEventListener('click', function(domEvent){
    if (!seaRoutePlacing) return;
    domEvent.stopPropagation();
    domEvent.preventDefault();
    const latlng = seaChartMap.mouseEventToLatLng(domEvent);
    onSeaChartMapClick(latlng);
  }, true);

  setTimeout(()=>{ if (seaChartMap) seaChartMap.invalidateSize(); },200);
}

function setSeaChartInteractive(enabled){
  if (!seaChartMap) return;
  ['dragging','scrollWheelZoom','touchZoom','doubleClickZoom','boxZoom'].forEach(name => {
    const handler = seaChartMap[name];
    if (!handler) return;
    if (enabled) handler.enable(); else handler.disable();
  });
}
let seaChartWrapOriginalParent=null, seaChartWrapOriginalNextSibling=null;
function enterSeaChartFullscreen(){
  const wrap=document.getElementById("seaChartWrap");
  const overlay=document.getElementById("seaChartActivateOverlay");
  const closeBtn=document.getElementById("seaChartCloseBtn");
  if (!wrap) return;
  // .page-elementeillä on sisääntuloanimaatio (transform), joka jää computed-tyyliin animaation
  // päätyttyäkin (matrix(1,0,0,1,0,0)) - CSS-spesifikaation mukaan mikä tahansa transform-arvo,
  // vaikka identiteettimatriisi, luo position:fixed-lapsille oman containing blockin, jolloin
  // "kiinteä" kartta jäisikin kiinni sivun vieritykseen eikä peittäisi koko näyttöä. Siirretään
  // siksi kartta suoraan bodyn lapseksi täysinäytön ajaksi ja palautetaan paikalleen suljettaessa.
  seaChartWrapOriginalParent = wrap.parentElement;
  seaChartWrapOriginalNextSibling = wrap.nextSibling;
  document.body.appendChild(wrap);
  wrap.classList.add("sea-chart-maximized");
  if (overlay) overlay.hidden = true;
  if (closeBtn) closeBtn.hidden = false;
  setSeaChartInteractive(true);
  setTimeout(()=>{ if (seaChartMap) seaChartMap.invalidateSize(); },50);
}
function exitSeaChartFullscreen(){
  const wrap=document.getElementById("seaChartWrap");
  const overlay=document.getElementById("seaChartActivateOverlay");
  const closeBtn=document.getElementById("seaChartCloseBtn");
  if (!wrap) return;
  wrap.classList.remove("sea-chart-maximized");
  if (overlay) overlay.hidden = false;
  if (closeBtn) closeBtn.hidden = true;
  setSeaChartInteractive(false);
  // Jokainen erikseen piilotettu paneeli palautetaan näkyviin seuraavaa avauskertaa varten -
  // piilotus on kertakäyttöinen siistimistila tälle istunnolle, ei pysyvä asetus.
  setSeaPanelHidden("seaChartToolbar", "seaToolbarReopenBtn", false);
  setSeaPanelHidden("seaChartBottomLeft", "seaHudReopenBtn", false);
  if (seaChartWrapOriginalParent) {
    seaChartWrapOriginalParent.insertBefore(wrap, seaChartWrapOriginalNextSibling);
  }
  setTimeout(()=>{ if (seaChartMap) seaChartMap.invalidateSize(); },50);
}
// Yksi paneeli kerrallaan piiloon/takaisin - sama malli kuin varoitusbannerin ⚠️-badge:
// pieni "chip" jää samalle paikalle muistuttamaan että paneeli on vain piilossa, ei poistettu.
function setSeaPanelHidden(panelId, badgeId, hidden){
  const panel=document.getElementById(panelId);
  const badge=document.getElementById(badgeId);
  // Luokka eikä hidden-attribuutti, koska esim. .sea-chart-bottom-left asettaa oman
  // display:flex-arvonsa, joka muuten ohittaisi selaimen oletus-[hidden]-säännön.
  if (panel) panel.classList.toggle("sea-panel-hidden", hidden);
  if (badge) badge.hidden = !hidden;
}
function toggleSeaChartSeamarks(show){
  if (!seaChartMap || !seaChartSeamarkLayer) return;
  if (show) { if (!seaChartMap.hasLayer(seaChartSeamarkLayer)) seaChartMap.addLayer(seaChartSeamarkLayer); }
  else { if (seaChartMap.hasLayer(seaChartSeamarkLayer)) seaChartMap.removeLayer(seaChartSeamarkLayer); }
}
function locateSeaChart(){
  if (!("geolocation" in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    pos => { if (seaChartMap) seaChartMap.setView([pos.coords.latitude, pos.coords.longitude], 12); },
    () => {},
    { timeout: 8000 }
  );
  startSeaSpeedWatch();
}

let seaSpeedWatchId=null, seaMeMarker=null;
function startSeaSpeedWatch(){
  if (seaSpeedWatchId !== null) return;
  if (!("geolocation" in navigator)) return;
  seaSpeedWatchId = navigator.geolocation.watchPosition(
    pos => {
      const el = document.getElementById("seaSpeedValue");
      if (el && typeof pos.coords.speed === 'number' && pos.coords.speed !== null) {
        const knots = (pos.coords.speed * 1.94384).toFixed(1);
        el.textContent = `${knots} kn`;
      }
      if (seaChartMap) {
        const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
        if (!seaMeMarker) {
          seaMeMarker = L.marker(latlng, { icon: L.divIcon({className:'', html:'<div class="sea-me-dot"></div>', iconSize:[18,18], iconAnchor:[9,9]}), zIndexOffset: 1000 }).addTo(seaChartMap);
          seaMeMarker.bindPopup('<div class="nearby-popup"><h4>Oma sijaintisi</h4></div>');
        } else {
          seaMeMarker.setLatLng(latlng);
        }
      }
    },
    () => {},
    { enableHighAccuracy:true, maximumAge:2000 }
  );
}

let seaWeatherFetchToken=0;
async function fetchMarineWeather(loc){
  const url=`https://marine-api.open-meteo.com/v1/marine?latitude=${loc.lat}&longitude=${loc.lon}&hourly=wave_height,wave_direction&timezone=auto`;
  const controller=new AbortController();
  const timeoutId=setTimeout(()=>controller.abort(),6500);
  try{
    const res=await fetch(url,{signal:controller.signal});
    clearTimeout(timeoutId);
    if(!res.ok) throw new Error("Aallokkotietojen haku epäonnistui");
    return await res.json();
  }catch(err){clearTimeout(timeoutId);throw err}
}

async function updateSeaChartWeather(){
  if (!seaChartMap) return;
  const windEl=document.getElementById("seaWindValue");
  const tempEl=document.getElementById("seaTempValue");
  const waveEl=document.getElementById("seaWaveValue");
  if (!windEl || !tempEl) return;
  const center=seaChartMap.getCenter();
  const token=++seaWeatherFetchToken;
  try {
    const data = await fetchWeather({ lat: center.lat, lon: center.lng });
    if (token !== seaWeatherFetchToken) return;
    const idx = nearestHourIndex(data.hourly.time);
    const windDir = degToCompass(data.hourly.wind_direction_10m[idx]);
    windEl.textContent = `${data.hourly.wind_speed_10m[idx].toFixed(1)} m/s ${windDir}`;
    tempEl.textContent = `${data.hourly.temperature_2m[idx].toFixed(0)}°C`;
  } catch (e) {
    // Sään haku epäonnistui - HUD näyttää vain "-", kartta toimii silti.
  }
  if (waveEl) {
    try {
      const marine = await fetchMarineWeather({ lat: center.lat, lon: center.lng });
      if (token !== seaWeatherFetchToken) return;
      const idx2 = nearestHourIndex(marine.hourly.time);
      const h = marine.hourly.wave_height[idx2];
      waveEl.textContent = (typeof h === 'number') ? `${h.toFixed(1)} m` : 'Ei tietoa';
    } catch (e) {
      waveEl.textContent = 'Ei tietoa';
    }
  }
}

// Väylävirasto/Traficom avoin OGC API Features -rajapinta (CC BY 4.0). Aineiston kuvauksessa
// lukee virallisesti "Aineisto ei sovellu navigointikäyttöön" - siksi tätä käytetään vain
// suunnittelun tueksi, ei koskaan auktoritatiivisena navigointiohjeena (ks. sea-chart-disclaimer).
const VAYLAPILVI_BASE = 'https://avoinapi.vaylapilvi.fi/vaylatiedot/ogc/features/v1/collections/';
const SEA_CHART_MIN_ZOOM = 10; // Turvalaitteita on n. 35 000 koko maassa - ei koskaan haeta ilman bbox-rajausta.

let officialLayerGroup=null, officialLayersWanted=true, officialLayersFetchToken=0;
// Aiemmin yksi "Väylät ja karikot" -kytkin näytti kaiken samalla kertaa - käyttäjä halusi
// päättää erikseen mitkä tasoista näkyvät. Haku tapahtuu silti yhtenä pyyntönä (yksinkertaisempi
// ja verkon kannalta sama kuorma kuin ennenkin), mutta piirto suodattuu näiden mukaan.
let officialSubLayers={ lines:true, areaOutline:true, speedZones:true, equipment:true };

async function fetchVaylapilviCollection(collectionId, bbox, limit){
  const url = `${VAYLAPILVI_BASE}${encodeURIComponent(collectionId)}/items?f=json&bbox=${bbox.join(',')}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('vaylapilvi fetch failed: ' + res.status);
  return res.json();
}

// Käyttäjäpalaute: ei tummennuksia väyläalueelle, vain nopeusrajoitusalueille. Ei täyttöväriä -
// ohut raja kertoo silti väyläalueen leveyden ilman että se peittää muuta karttaa.
function styleFairwayArea(){
  return { fill:false, color:'#2f7fa8', weight:1, opacity:.4 };
}
// Väylän keskilinja (vaylat_uusi) on eri kokoelma kuin väyläalue (vaylaalueet_uusi) -
// tämä on itse merkitty kulkulinja, ei koko väylän leveä alue. Selkeä musta viiva, kuten
// käyttäjä pyysi - ei tummennuksia tälle tasolle.
function styleFairwayLine(){
  return { color:'#111', weight:2.5, opacity:.85, lineCap:'round' };
}
// Ainoa taso jota käyttäjän toiveesta tummennetaan/väritetään - nopeusrajoitusalue.
function styleSpeedZone(){
  return { color:'#a94635', weight:1, fillColor:'#a94635', fillOpacity:.18 };
}
function safetyEquipmentIcon(){
  return L.divIcon({ className:'', html:'<div class="sea-mark-dot"></div>', iconSize:[14,14], iconAnchor:[7,7] });
}
function hazardMarkIcon(){
  return L.divIcon({ className:'', html:'<div class="sea-hazard-mark"></div>', iconSize:[16,16], iconAnchor:[8,8] });
}
// Väylävirasto-datan navigointilajikoodi 3-6 = kardinaalimerkit (pohjois/etelä/länsi/itä),
// jotka osoittavat kummalta puolelta jokin vaarallinen kohde ohitetaan turvallisesti, ja koodi
// 7 = erillisvaara-/reunamerkki. HUOM (käyttäjäpalaute): rajapinnan attribuutit eivät kerro
// TARKKAA syytä - kohde voi olla kivi, kari, matalikko, hylky tai muu este. Ei siis väitetä
// tekstissä että kyseessä olisi aina nimenomaan kivi, vain että alueella on jokin este.
const HAZARD_NAV_CODES = new Set([3,4,5,6,7]);
function isHazardMark(props){
  return HAZARD_NAV_CODES.has(props && props.navigointilajikoodi);
}

// Turvalaitteita voi olla tiheässä saaristossa satoja yhden näkymän sisällä - rajapinta ei
// itse rajoita määrää muuta kuin bbox:lla. Vaaramerkit (kardinaali-/reunamerkit) näytetään
// aina kaikki, koska ne ovat turvallisuuden kannalta oleellisia ja huomattavasti harvinaisempia.
// Tavalliset suuntamerkit sulautetaan lähekkäin samaan tapaan kuin kalaspotit (ks.
// dedupePotentialSpots), jotta kartta pysyy luettavana eikä pelkkä merkkimäärä peitä muuta.
function thinEquipmentFeatures(features){
  const hazards=[], plain=[];
  for (const f of features) {
    if (!f || !f.geometry || !Array.isArray(f.geometry.coordinates)) continue;
    (isHazardMark(f.properties||{}) ? hazards : plain).push(f);
  }
  const minSeparation=Math.max(90, 40*potentialMetersPerPixel());
  const maxPlain=90;
  const kept=[];
  for (const f of plain) {
    const c=f.geometry.coordinates;
    let merged=false;
    for (const k of kept) {
      const kc=k.geometry.coordinates;
      if (haversineMeters({lat:kc[1],lng:kc[0]},{lat:c[1],lng:c[0]})<minSeparation) {
        k._mergedCount=(k._mergedCount||1)+1;
        merged=true;
        break;
      }
    }
    if (merged) continue;
    if (kept.length>=maxPlain) continue;
    f._mergedCount=1;
    kept.push(f);
  }
  return hazards.concat(kept);
}

async function updateOfficialLayers(){
  if (!seaChartMap || !officialLayerGroup) return;
  officialLayerGroup.clearLayers();
  if (!officialLayersWanted) return;

  const zoomHintEl = document.getElementById("seaChartZoomHint");
  if (seaChartMap.getZoom() < SEA_CHART_MIN_ZOOM) {
    if (zoomHintEl) zoomHintEl.hidden = false;
    return;
  }
  if (zoomHintEl) zoomHintEl.hidden = true;

  const b = seaChartMap.getBounds();
  const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
  const token = ++officialLayersFetchToken;

  try {
    const [areas, fairwayLines, equipment, speedZones] = await Promise.all([
      fetchVaylapilviCollection('vesivaylatiedot:vaylaalueet_uusi', bbox, 300).catch(()=>null),
      fetchVaylapilviCollection('vesivaylatiedot:vaylat_uusi', bbox, 300).catch(()=>null),
      // 500 -> 1000: käyttäjäpalaute oli, että turvalaitteita puuttui kartalta tiheillä
      // saaristoalueilla - rajapinta itse rajoittaa vastauksen kokoa tarvittaessa, joten
      // suurempi pyyntö ei riskeeraa mitään, se vain sallii useamman merkin näkyä kerralla.
      fetchVaylapilviCollection('vesivaylatiedot:turvalaitteet_uusi', bbox, 1000).catch(()=>null),
      // 100 -> 300: käyttäjäpalaute oli, ettei kaikkia nopeusrajoituksia näkynyt tiheillä
      // alueilla - sama korjaus kuin turvalaitteille aiemmin.
      fetchVaylapilviCollection('vesivaylatiedot:vesivaylien_nopeusrajoitusalueet', bbox, 300).catch(()=>null)
    ]);
    if (token !== officialLayersFetchToken || !officialLayersWanted) return; // vanhentunut haku (kartta liikkui jo) tai kerros piilotettu haun aikana

    if (areas && officialSubLayers.areaOutline) {
      L.geoJSON(areas, { style: styleFairwayArea }).addTo(officialLayerGroup);
    }
    if (fairwayLines && officialSubLayers.lines) {
      L.geoJSON(fairwayLines, { style: styleFairwayLine }).addTo(officialLayerGroup);
    }
    if (speedZones && officialSubLayers.speedZones) {
      L.geoJSON(speedZones, {
        style: styleSpeedZone,
        onEachFeature: (feature, layer) => {
          const p = feature.properties || {};
          // Ei enää pysyvää kelluvaa tekstilappua jokaisen alueen päällä (teki kartasta
          // sekavan monen alueen kanssa) - tiedot näkyvät klikatessa popupista.
          const label = p.suuruus ? `${p.suuruus} km/h` : 'Nopeusrajoitus';
          layer.bindPopup(`<div class="nearby-popup"><h4>${label}</h4><p>${p.nimisijainti||''}${p.poikkeus ? ' · '+p.poikkeus : ''}</p></div>`);
        }
      }).addTo(officialLayerGroup);
    }
    if (equipment && officialSubLayers.equipment) {
      const thinnedEquipment = { ...equipment, features: thinEquipmentFeatures(equipment.features || []) };
      L.geoJSON(thinnedEquipment, {
        pointToLayer: (feature, latlng) => {
          const p = feature.properties || {};
          return L.marker(latlng, { icon: isHazardMark(p) ? hazardMarkIcon() : safetyEquipmentIcon(), zIndexOffset: isHazardMark(p) ? 500 : 0 });
        },
        onEachFeature: (feature, layer) => {
          const p = feature.properties || {};
          const name = p.nimifi || p.turvalaitetyyppifi || 'Turvalaite';
          const hazard = isHazardMark(p);
          const hazardNote = hazard
            ? `<p style="color:#a92f1f;font-weight:700;">⚠️ Virallinen vaaramerkki - alueella on jokin vaarallinen kohde (esim. kivi, kari, matalikko tai hylky - tarkka syy vaihtelee eikä ole aina tiedossa). Pidä etäisyyttä. Ei koskaan navigointiohje, tarkista virallisesta merikartasta.</p>`
            : '';
          const mergedNote = feature._mergedCount > 1
            ? `<p class="potential-area">Tässä kohtaa on ${feature._mergedCount} lähekkäistä turvalaitetta. Zoomaa lähemmäs nähdäksesi ne erikseen.</p>`
            : '';
          layer.bindPopup(`<div class="nearby-popup"><h4>${hazard ? '⚠️ ' : ''}${name}</h4><p>${p.turvalaitetyyppifi||''}${p.sijaintifi ? ' · '+p.sijaintifi : ''}</p>${hazardNote}${mergedNote}</div>`);
        }
      }).addTo(officialLayerGroup);
    }
  } catch (e) {
    // Verkkovirhe tms. - kartta toimii silti ilman virallista kerrosta, ei kaadu.
  }
}

function toggleOfficialLayers(show){
  officialLayersWanted = show;
  updateOfficialLayers();
}

// --- Reittiehdotus: reititetään AINA virallisia navigointilinjoja (merkittyjä väyliä) pitkin,
// ei koskaan vapaasti avoveden/syvyyspolygonien yli - saariston kivikoissa juuri merkityltä
// väylältä poikkeaminen on tapa jolla pohjaan ajetaan. Ei koskaan navigointiohje, ks.
// sea-route-disclaimer. Ohitussivu-tietoa (miltä puolelta ohittaa merkki) ei näytetä, koska
// turvalaitteiden lateraalisivu-attribuuttia ei ole vielä varmistettu luotettavaksi.
let seaRoute = { startLatLng:null, endLatLng:null, startMarker:null, endMarker:null, routeLayer:null };

function haversineMeters(a, b){
  const R=6371000, toRad=d=>d*Math.PI/180;
  const dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng);
  const s=Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}
function routeNodeKey(latlng){ return latlng.lat.toFixed(4)+','+latlng.lng.toFixed(4); }

async function buildRouteGraph(bbox){
  const data = await fetchVaylapilviCollection('vesivaylatiedot:navigointilinjat_uusi', bbox, 1000);
  const graph = new Map();
  const nodeLatLng = new Map();
  function addEdge(fromKey, toKey, weight, coords, id){
    if (!graph.has(fromKey)) graph.set(fromKey, []);
    graph.get(fromKey).push({ to: toKey, weight, coords, id });
  }
  (data.features||[]).forEach(f => {
    const coords = f.geometry && f.geometry.coordinates;
    if (!coords || coords.length < 2) return;
    const first = L.latLng(coords[0][1], coords[0][0]);
    const last = L.latLng(coords[coords.length-1][1], coords[coords.length-1][0]);
    const fKey = routeNodeKey(first), lKey = routeNodeKey(last);
    nodeLatLng.set(fKey, first);
    nodeLatLng.set(lKey, last);
    const latlngs = coords.map(c => L.latLng(c[1], c[0]));
    const weight = (f.properties && f.properties.pituus) || haversineMeters(first, last);
    const id = f.properties && f.properties.navigointilinjaid;
    addEdge(fKey, lKey, weight, latlngs, id);
    addEdge(lKey, fKey, weight, latlngs.slice().reverse(), id);
  });
  return { graph, nodeLatLng };
}

function findNearestRouteNode(nodeLatLng, latlng, maxMeters){
  let best=null, bestDist=Infinity;
  nodeLatLng.forEach((nll, key) => {
    const d = latlng.distanceTo(nll);
    if (d < bestDist) { bestDist = d; best = key; }
  });
  if (best && bestDist <= maxMeters) return { key: best, dist: bestDist };
  return null;
}

function dijkstraRoute(graph, startKey, endKey){
  const dist = new Map([[startKey, 0]]);
  const prevEdge = new Map();
  const visited = new Set();
  while (true) {
    let u=null, uDist=Infinity;
    dist.forEach((d,k) => { if (!visited.has(k) && d < uDist) { uDist=d; u=k; } });
    if (u===null) break;
    if (u===endKey) break;
    visited.add(u);
    (graph.get(u) || []).forEach(e => {
      const nd = uDist + e.weight;
      if (nd < (dist.has(e.to) ? dist.get(e.to) : Infinity)) {
        dist.set(e.to, nd);
        prevEdge.set(e.to, { from:u, edge:e });
      }
    });
  }
  if (!dist.has(endKey)) return null;
  const edges=[]; let cur=endKey;
  while (cur !== startKey) {
    const pe = prevEdge.get(cur);
    if (!pe) return null;
    edges.unshift(pe.edge);
    cur = pe.from;
  }
  return { edges, totalMeters: dist.get(endKey) };
}

// --- Avoveden reititys ilman merkittyä väylää ------------------------------------------------
// Käyttäjän nimenomaisesta pyynnöstä: reititetään myös kun pisteiden välillä ei ole yhtenäistä
// merkittyä väylää - erityisesti sisäjärvillä, joilla kauppamerenkulun väyliä ei useimmiten ole
// lainkaan, vaikka kalastusreitti olisi ihan tavallinen. Tämä perustuu OSM-vesialuedataan (mikä
// on vettä/maata) ja Väylävirasto/Traficom-karimerkkeihin, joita vältetään puskurilla. TÄRKEÄ
// RAJOITUS: tässä EI ole minkäänlaista syvyys- tai kivikkodataa yksittäisistä kartoittamattomista
// kivistä - varsinkaan pienillä sisäjärvillä ei ole virallista syvyyskartoitusta ollenkaan. Siksi
// tulos piirretään aina selvästi eri tyylillä kuin merkitty väylä ja sen mukana näytetään vahva
// varoitus (ks. drawOpenWaterRouteInfo) - tämä ei korvaa merkittyä väylää eikä ole koskaan
// navigointiohje, ks. sea-chart-disclaimer.

function metersPerDegLat(){ return 111320; }
function metersPerDegLng(atLat){ return 111320 * Math.cos(atLat * Math.PI/180); }

function pointInRing(lat, lng, ring){
  let inside = false;
  for (let i=0, j=ring.length-1; i<ring.length; j=i++) {
    const yi=ring[i][0], xi=ring[i][1], yj=ring[j][0], xj=ring[j][1];
    const intersect = ((yi>lat) !== (yj>lat)) && (lng < (xj-xi)*(lat-yi)/(yj-yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
function pointInAnyPolygon(lat, lng, polygons){
  for (const ring of polygons) { if (pointInRing(lat,lng,ring)) return true; }
  return false;
}

// OpenStreetMap Overpass -rajapinta (avoin data, ODbL) vesialueiden (järvet, joet, lahdet)
// ääriviivoille - käytetään vain reitityksen maa/vesi-erotteluun, ei minkäänlaiseen
// syvyys- tai navigointitarkkuuteen. Julkinen Overpass-palvelu on ajoittain ruuhkautunut ja
// hylkää pyyntöjä ("The server is probably too busy") - siksi yritetään kahta eri julkista
// peilipalvelinta aikakatkaisulla, ennen kuin luovutetaan (jolloin computeAndDrawRoute putoaa
// suoraan viivayhteyteen, ks. yllä).
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

// --- Koko Suomen potentiaaliset kalapaikat -----------------------------------------------
// Koko Suomen vahvat kohteet toimitetaan sivun mukana kompaktina tiedostona. Selain ei enää
// odota ruuhkaista Overpass-hakua karttaa siirrettäessä. Aineistossa ovat vain nimenomaisesti
// kalastukseen merkityt paikat sekä nimetyt kosket, virtasuvannot, matalikot ja salmet.
const POTENTIAL_SPOT_DATA_URL = '/kalapaikat.json';
const POTENTIAL_SPOT_MIN_ZOOM = 6;
const POTENTIAL_SPOT_MAX_RESULTS = 120;
const FINLAND_DATA_BOUNDS = { south:59.3, west:19.0, north:70.3, east:31.7 };

let potentialSpotLayerGroup=null;
let potentialSpotsWanted=false;
let potentialSpotFetchToken=0;
let potentialSpotUpdateTimer=null;
let potentialSpotDataPromise=null;
let potentialSpotDatasetMeta=null;
const potentialWeatherCache=new Map();
const potentialSpotMarkersById=new Map();
let potentialSpotLastElements=[];
let potentialSpotLastSpots=[];
let potentialWeatherFetchSignature='';
let potentialResultsUserClosed=false;
let potentialFavoriteSetCache=null;

function potentialSpotStatus(fi, en, loading=false){
  const el=document.getElementById('potentialSpotStatus');
  if (el) {
    el.textContent=currentLang==='fi' ? fi : en;
    el.classList.toggle('is-loading',loading);
  }
}

function escapeMapHtml(value){
  return String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function potentialSpeciesName(id){
  const names={
    fi:{ahven:'ahven',hauki:'hauki',kuha:'kuha',taimen:'taimen',lohi:'lohi',siika:'siika',harjus:'harjus'},
    en:{ahven:'perch',hauki:'pike',kuha:'zander',taimen:'trout',lohi:'salmon',siika:'whitefish',harjus:'grayling'}
  };
  return (names[currentLang==='fi'?'fi':'en'][id] || id);
}

function potentialElementLatLng(el){
  if (typeof el.lat==='number' && typeof el.lon==='number') return {lat:el.lat, lon:el.lon};
  if (el.center && typeof el.center.lat==='number' && typeof el.center.lon==='number') return {lat:el.center.lat, lon:el.center.lon};
  if (el.bounds) return {lat:(el.bounds.minlat+el.bounds.maxlat)/2, lon:(el.bounds.minlon+el.bounds.maxlon)/2};
  return null;
}

function classifyPotentialSpot(el, selectedSpecies){
  const t=el.tags||{};
  const ll=potentialElementLatLng(el);
  if (!ll) return null;

  const leisure=String(t.leisure||'').toLowerCase();
  const water=String(t.water||'').toLowerCase();
  const amenity=String(t.amenity||'').toLowerCase();
  const manMade=String(t.man_made||'').toLowerCase();
  const clearlyNotFishable=
    ['swimming_pool','wading_pool','water_park','splash_pad'].includes(leisure) ||
    ['swimming_pool','wading_pool','splash_pool','wastewater','sewage'].includes(water) ||
    amenity==='fountain' || water==='fountain' ||
    ['wastewater_plant','sewage_treatment'].includes(manMade);
  if (clearlyNotFishable || t.fishing==='no' || t.access==='private' || t.access==='no') return null;

  const isTaggedFishing=t.leisure==='fishing' || t.sport==='fishing' || (t.fishing && t.fishing!=='no');
  const isRapids=t.waterway==='rapids' || t.water==='rapids';
  let meta=null;

  if (isTaggedFishing) meta={
    key:'known', score:94, species:[],
    kindFi:'Kartoitettu kalastuspaikka', kindEn:'Mapped fishing place',
    nameFi:'Merkitty kalastuspaikka', nameEn:'Mapped fishing place',
    reasonFi:'Kohde on merkitty avoimeen karttadataan kalastuspaikaksi. Tämä on vahvin käyttämämme paikkasignaali.',
    reasonEn:'The site is explicitly mapped as a fishing place. This is the strongest location signal used here.',
    warningFi:'Karttamerkintä ei takaa vapaata pääsyä eikä voimassa olevaa kalastuslupaa.',
    warningEn:'A map tag does not guarantee public access or a valid fishing permit.'
  };
  else if (isRapids) meta={
    key:'rapids', score:82, species:['taimen','lohi','harjus','ahven'],
    kindFi:'Koski tai voimakas virta', kindEn:'Rapids or strong current',
    nameFi:'Koskirakenne', nameEn:'Rapids structure',
    reasonFi:'Virran reunat, niska ja alapuolinen suvanto kokoavat ravintoa ja tarjoavat kaloille suojaisia virranvaihteluita.',
    reasonEn:'Current seams, the head of the rapid and the pool below can concentrate food and create holding water.',
    warningFi:'Koski- ja virta-alueilla erillislupa on usein pakollinen ja kalastus voi olla rajoitettua.',
    warningEn:'Rapids and migratory-fish waters often require a separate permit and may have restrictions.'
  };
  else if (t.natural==='shoal') meta={
    key:'shoal', score:84, species:['ahven','hauki','kuha','siika'],
    kindFi:'Matalikko', kindEn:'Shoal',
    nameFi:'Matalikko', nameEn:'Shoal',
    reasonFi:'Matalikon reunalla syvyys muuttuu nopeasti. Reuna voi kerätä pikkukalaa ja tarjoaa petokaloille väijyntälinjan.',
    reasonEn:'Depth changes at a shoal edge can gather baitfish and create a feeding line for predators.',
    warningFi:'Matalikko voi olla veneelle vaarallinen. Tarkista syvyys virallisesta kartasta.',
    warningEn:'A shoal can be hazardous to boats. Verify depth on an official chart.'
  };
  else if (t.natural==='strait') meta={
    key:'strait', score:76, species:['ahven','hauki','kuha','siika'],
    kindFi:'Salmi tai kapeikko', kindEn:'Strait or narrows',
    nameFi:'Virtaava kapeikko', nameEn:'Flowing narrows',
    reasonFi:'Kapeikko voimistaa veden liikettä ja ohjaa pikkukalan sekä petokalojen kulkua samaan kohtaan.',
    reasonEn:'Narrows can strengthen water movement and funnel baitfish and predators through the same area.',
    warningFi:'Veneväylät ja rantojen yksityisyys on tarkistettava erikseen.',
    warningEn:'Check fairways and shoreline access separately.'
  };
  else if (t.water==='stream_pool') meta={
    key:'pool', score:80, species:['taimen','harjus','ahven'],
    kindFi:'Virtasuvanto', kindEn:'Stream pool',
    nameFi:'Virtasuvanto', nameEn:'Stream pool',
    reasonFi:'Syvempi, hitaampi tasku virtavedessä tarjoaa kaloille lepopaikan aivan ravintoa kuljettavan virran vieressä.',
    reasonEn:'A deeper slow pocket beside current gives fish a holding area close to drifting food.',
    warningFi:'Virtavesien luvat ja rauhoitukset on tarkistettava ennen kalastusta.',
    warningEn:'Check permits and closures for flowing waters before fishing.'
  };
  if (!meta) return null;

  let score=meta.score;
  if (selectedSpecies && selectedSpecies!=='all' && meta.species.length) {
    score += meta.species.includes(selectedSpecies) ? 7 : -13;
  }
  if (t.name || t['name:fi']) score += 2;
  score=Math.max(42,Math.min(96,Math.round(score)));
  const fi=currentLang==='fi';
  return {
    id:`${el.type}-${el.id}`,
    lat:ll.lat, lon:ll.lon, score,
    structureScore:score,
    kind:fi?meta.kindFi:meta.kindEn,
    name:t['name:fi']||t.name||(fi?meta.nameFi:meta.nameEn),
    reason:fi?meta.reasonFi:meta.reasonEn,
    warning:fi?meta.warningFi:meta.warningEn,
    species:meta.species,
    typeKey:meta.key,
    sourceUrl:`https://www.openstreetmap.org/${encodeURIComponent(el.type)}/${encodeURIComponent(el.id)}`
  };
}

// Kartan mittakaava: montako metriä yksi ruudun pikseli vastaa nykyisellä zoomilla.
function potentialMetersPerPixel(){
  if (!seaChartMap) return 1;
  const lat=seaChartMap.getCenter().lat;
  return 156543.03392*Math.cos(lat*Math.PI/180)/Math.pow(2,seaChartMap.getZoom());
}

// Mitä kauempaa katsotaan, sitä harvempi valikoima: yksi merkki edustaa laajempaa aluetta.
//
// Aiemmin nämä katot (120/70/40/25) sallivat kymmeniä merkkejä ruudulla yhtä aikaa, mikä
// näytti käyttökelvottomalta ruuhkalta - itse merkkien limittymisen esto (ks. minSeparation
// alla) ei riittänyt, koska pelkkä "eivät mene päällekkäin" ei tarkoita "on helppo silmäillä".
// Käytännölliseen karttaan mahtuu kerralla vain kourallinen kohteita; loput löytyvät zoomaamalla.
function potentialMaxResults(){
  const zoom=seaChartMap?seaChartMap.getZoom():12;
  if (zoom>=14) return 30;
  if (zoom>=12) return 18;
  if (zoom>=10) return 10;
  return 6;
}

// Yhdistää lähekkäiset kohteet yhdeksi merkiksi, joka edustaa koko aluetta.
//
// Vähimmäisväli oli aiemmin kiinteä 260 metriä. Lähelle zoomattuna se riitti, mutta
// uloszoomattuna 260 metriä on ruudulla alle pikselin - silloin kymmenet saman matalikon tai
// kivikon pisteet piirtyivät päällekkäin ja kartta näytti sadalta merkiltä vierekkäin. Väli
// lasketaan siksi ruudun pikseleinä: vierekkäisten merkkien välissä on aina vähintään merkin
// oma leveys, oli zoom mikä tahansa. Sulautetut kohteet lasketaan mukaan mergedCountiin, jotta
// käyttäjälle voi kertoa merkin edustavan aluetta eikä yhtä pistettä.
function dedupePotentialSpots(spots){
  const kept=[];
  const maxResults=potentialMaxResults();
  const minSeparation=Math.max(300, 64*potentialMetersPerPixel());
  spots.sort((a,b)=>b.score-a.score);
  for (const spot of spots) {
    let host=null, hostDistance=Infinity;
    for (const k of kept) {
      const d=haversineMeters({lat:k.lat,lng:k.lon},{lat:spot.lat,lng:spot.lon});
      if (d<minSeparation && d<hostDistance) { host=k; hostDistance=d; }
    }
    if (host) {
      // Paras piste jää edustamaan aluetta, heikommat sulautuvat siihen.
      host.mergedCount=(host.mergedCount||1)+1;
      host.areaRadiusM=Math.max(host.areaRadiusM||0, hostDistance);
      continue;
    }
    // Rajan täytyttyä ei enää lisätä uusia, mutta sulautuminen jatkuu jotta alueiden
    // kohdemäärät pysyvät oikeina.
    if (kept.length>=maxResults) continue;
    spot.mergedCount=1;
    spot.areaRadiusM=0;
    kept.push(spot);
  }
  return kept;
}

function potentialSpotColor(score){
  if (score>=86) return '#2f6f73';
  if (score>=72) return '#d5752c';
  if (score>=60) return '#8a6b2f';
  return '#6e7772';
}

function potentialRankScore(spot){
  return typeof spot.combinedScore==='number' ? spot.combinedScore : spot.structureScore;
}

function potentialQualityThreshold(){
  const el=document.getElementById('potentialSpotQuality');
  return el ? Number(el.value)||0 : 80;
}

function potentialFavoriteIds(){
  if (potentialFavoriteSetCache) return potentialFavoriteSetCache;
  try {
    const parsed=JSON.parse(storage.getItem('potential_spot_favorites')||'[]');
    potentialFavoriteSetCache=new Set(Array.isArray(parsed)?parsed:[]);
  } catch(e) { potentialFavoriteSetCache=new Set(); }
  return potentialFavoriteSetCache;
}

function isPotentialFavorite(id){ return potentialFavoriteIds().has(id); }

function togglePotentialFavorite(spot){
  const ids=potentialFavoriteIds();
  if (ids.has(spot.id)) ids.delete(spot.id); else ids.add(spot.id);
  storage.setItem('potential_spot_favorites',JSON.stringify([...ids]));
  if (potentialSpotLastSpots.length) drawPotentialSpotMarkers(potentialSpotLastSpots,potentialSpotLastElements.length);
}

function potentialWeatherSpecies(selectedSpecies){
  return selectedSpecies==='all' ? ['ahven','hauki','kuha'] : [selectedSpecies];
}

function potentialWeatherCacheKey(spot, selectedSpecies){
  return `${spot.id}:${selectedSpecies}:${Math.floor(Date.now()/600000)}`;
}

function applyPotentialWeatherFromCache(spots, selectedSpecies){
  spots.forEach(spot=>{
    const cached=potentialWeatherCache.get(potentialWeatherCacheKey(spot,selectedSpecies));
    if (cached) Object.assign(spot,cached);
  });
}

async function enrichPotentialSpotsWithWeather(spots, selectedSpecies, token){
  const candidates=spots.slice(0,18);
  const missing=candidates.filter(spot=>!potentialWeatherCache.has(potentialWeatherCacheKey(spot,selectedSpecies)));
  if (!missing.length) {
    applyPotentialWeatherFromCache(spots,selectedSpecies);
    if (token===potentialSpotFetchToken) drawPotentialSpotMarkers(spots,potentialSpotLastElements.length);
    return;
  }
  const signature=`${token}:${selectedSpecies}:`+missing.map(s=>s.id).join(',');
  if (potentialWeatherFetchSignature===signature) return;
  potentialWeatherFetchSignature=signature;
  try {
    const dataArr=await fetchWeatherBatch(missing);
    if (token!==potentialSpotFetchToken || !potentialSpotsWanted) return;
    const scoreSpecies=potentialWeatherSpecies(selectedSpecies);
    missing.forEach((spot,i)=>{
      const data=dataArr[i];
      if (!data || !data.hourly) return;
      const idx=nearestHourIndex(data.hourly.time);
      const infos=scoreSpecies.map(species=>computeScore(data,idx,species,spot));
      const weatherScore=Math.round(infos.reduce((sum,info)=>sum+info.score,0)/infos.length);
      const info=infos[0];
      const live={
        weatherScore,
        combinedScore:Math.round(spot.structureScore*.68+weatherScore*.32),
        liveWeather:{wind:info.wind,temp:info.temp,cloud:info.cloud,delta:info.delta,isPrimeTime:info.isPrimeTime}
      };
      potentialWeatherCache.set(potentialWeatherCacheKey(spot,selectedSpecies),live);
      Object.assign(spot,live);
    });
    applyPotentialWeatherFromCache(spots,selectedSpecies);
    drawPotentialSpotMarkers(spots,potentialSpotLastElements.length);
  } catch(e) {
    // Sääkerros on lisäarvo: rakennetiedot jäävät näkyviin, vaikka Open-Meteo olisi hetkellisesti poissa.
  } finally {
    if (potentialWeatherFetchSignature===signature) potentialWeatherFetchSignature='';
  }
}

function togglePotentialResultsPanel(show, userAction=false){
  const panel=document.getElementById('potentialResultsPanel');
  const toggle=document.getElementById('potentialResultsToggle');
  if (panel) panel.hidden=!show;
  if (userAction) potentialResultsUserClosed=!show;
  if (toggle) toggle.textContent=currentLang==='fi'?(show?'Piilota lista':'Top-lista'):(show?'Hide list':'Top list');
}

function focusPotentialSpot(id){
  const marker=potentialSpotMarkersById.get(id);
  if (!marker || !seaChartMap) return;
  seaChartMap.panTo(marker.getLatLng(),{animate:true});
  marker.openPopup();
}

function renderPotentialResults(spots){
  const list=document.getElementById('potentialResultsList');
  const sub=document.getElementById('potentialResultsSub');
  const panel=document.getElementById('potentialResultsPanel');
  if (!list || !panel) return;
  const fi=currentLang==='fi';
  const ranked=spots.slice().sort((a,b)=>potentialRankScore(b)-potentialRankScore(a)).slice(0,10);
  if (sub) sub.textContent=fi
    ? `${spots.length} näkyvissä · rakenne${ranked.some(s=>s.liveWeather)?' + tämänhetkinen keli':''}`
    : `${spots.length} visible · structure${ranked.some(s=>s.liveWeather)?' + current conditions':''}`;
  if (!ranked.length) {
    list.innerHTML=`<p class="potential-results-empty">${fi?'Nykyisellä suodattimella ei ole paikkoja.':'No spots match the current filter.'}</p>`;
    panel.hidden=true;
    return;
  }
  const center=seaChartMap.getCenter();
  list.innerHTML=ranked.map((spot,index)=>{
    const score=potentialRankScore(spot);
    const distance=haversineKm(center.lat,center.lng,spot.lat,spot.lon);
    return `<div class="potential-result-row">
      <button class="potential-result-main" type="button" data-potential-jump="${escapeMapHtml(spot.id)}">
        <span class="potential-result-rank">#${index+1}</span>
        <span class="potential-result-copy"><span class="potential-result-name">${escapeMapHtml(spot.name)}</span><span class="potential-result-kind">${escapeMapHtml(spot.kind)}${spot.mergedCount>1?(fi?` · alue, ${spot.mergedCount} kohdetta`:` · area, ${spot.mergedCount} features`):''} · ${fmtKm(distance)}</span></span>
        <span class="potential-result-score" style="background:${potentialSpotColor(score)}">${score}</span>
      </button>
      <button class="potential-result-fav" type="button" data-potential-fav="${escapeMapHtml(spot.id)}" aria-label="${fi?'Tallenna suosikiksi':'Save favorite'}">${isPotentialFavorite(spot.id)?'★':'☆'}</button>
    </div>`;
  }).join('');
  list.querySelectorAll('[data-potential-jump]').forEach(btn=>btn.addEventListener('click',()=>focusPotentialSpot(btn.dataset.potentialJump)));
  list.querySelectorAll('[data-potential-fav]').forEach(btn=>btn.addEventListener('click',()=>{
    const spot=potentialSpotLastSpots.find(s=>s.id===btn.dataset.potentialFav);
    if (spot) togglePotentialFavorite(spot);
  }));
}

// Kun merkki edustaa useaa lähekkäistä kohdetta, se sanotaan ääneen - muuten lukija luulee
// näkevänsä yhden tarkan pisteen, vaikka kyse on laajemmasta matalikosta tai kivikosta.
function potentialAreaNote(spot, fi){
  if (!spot.mergedCount || spot.mergedCount<2) return '';
  const radius=Math.max(50, Math.round((spot.areaRadiusM||0)/50)*50);
  return `<p class="potential-area">${fi
    ? `Tämä merkki edustaa koko aluetta: lähistöllä on ${spot.mergedCount} samankaltaista kohdetta noin ${radius} metrin säteellä. Zoomaa lähemmäs nähdäksesi ne erikseen.`
    : `This marker represents a whole area: ${spot.mergedCount} similar features within about ${radius} m. Zoom in to see them separately.`}</p>`;
}

function potentialWeatherSummary(spot){
  if (!spot.liveWeather) return '';
  const w=spot.liveWeather, fi=currentLang==='fi';
  const trend=w.delta<=-1?'↘':w.delta>=1?'↗':'→';
  return fi
    ? `${w.temp.toFixed(0)} °C · tuuli ${w.wind.toFixed(1)} m/s · pilvisyys ${Math.round(w.cloud)} % · paine ${trend}${w.isPrimeTime?' · hämärän syönti-ikkuna':''}`
    : `${w.temp.toFixed(0)} °C · wind ${w.wind.toFixed(1)} m/s · cloud ${Math.round(w.cloud)}% · pressure ${trend}${w.isPrimeTime?' · twilight feeding window':''}`;
}

function usePotentialSpot(spot){
  const key=addDynamicLocation({name:spot.name,lat:spot.lat,lon:spot.lon});
  locSel.value=key;
  const species=document.getElementById('potentialSpotSpecies');
  if (species && species.value!=='all' && spSel.querySelector(`option[value="${species.value}"]`)) spSel.value=species.value;
  refresh();
  const wrap=document.getElementById('seaChartWrap');
  if (wrap && wrap.classList.contains('sea-chart-maximized')) exitSeaChartFullscreen();
  showPage('kelimittari');
}

function drawPotentialSpotMarkers(spots,totalElementCount){
  if (!potentialSpotLayerGroup || !potentialSpotsWanted) return;
  potentialSpotLayerGroup.clearLayers();
  potentialSpotMarkersById.clear();
  const fi=currentLang==='fi';
  const threshold=potentialQualityThreshold();
  const visible=spots
    .filter(spot=>potentialRankScore(spot)>=threshold || isPotentialFavorite(spot.id))
    .sort((a,b)=>potentialRankScore(b)-potentialRankScore(a));

  visible.forEach((spot,index)=>{
    const rankScore=potentialRankScore(spot);
    const icon=L.divIcon({
      className:'',
      html:`<div class="potential-spot-marker${spot.liveWeather?' has-weather':''}" style="background:${potentialSpotColor(rankScore)}"><span>${rankScore}</span></div>`,
      iconSize:[38,38],iconAnchor:[19,34],popupAnchor:[0,-31]
    });
    const marker=L.marker([spot.lat,spot.lon],{icon,zIndexOffset:650});
    const speciesText=spot.species.length
      ? spot.species.map(potentialSpeciesName).join(', ')
      : (fi?'useita lajeja':'multiple species');
    const useId=`potentialUse-${spot.id}-${index}`;
    const favId=`potentialFav-${spot.id}-${index}`;
    const center=seaChartMap.getCenter();
    const distance=haversineKm(center.lat,center.lng,spot.lat,spot.lon);
    const weatherSummaryLine=spot.liveWeather ? `<p class="potential-live">${escapeMapHtml(potentialWeatherSummary(spot))}</p>` : '';
    const weatherBreakdown=spot.liveWeather ? `<div class="potential-breakdown"><span>${fi?'Rakenne':'Structure'} ${spot.structureScore}</span><span>${fi?'Keli nyt':'Conditions'} ${spot.weatherScore}</span></div>` : '';
    // Popup näytti aiemmin kaiken kerralla (7-8 kappaletta tekstiä ennen toimintonappeja) - liikaa
    // luettavaa yhdellä silmäyksellä, varsinkin puhelimella. Oleellisin (mikä, missä, kuinka hyvä,
    // lyhyt varoitus) näkyy heti; syvempi perustelu ja koko lakiteksti jäävät "Lisätietoja"-taakse.
    marker.bindPopup(`<div class="nearby-popup potential-popup">
      <span class="potential-kind">${escapeMapHtml(spot.kind)}</span>
      <h4>${escapeMapHtml(spot.name)}</h4>
      <p class="potential-score">${spot.liveWeather?(fi?'Kokonaispotentiaali':'Overall potential'):(fi?'Rakenteen potentiaali':'Structure potential')}: ${rankScore}/100 · ${fmtKm(distance)} ${fi?'kartan keskeltä':'from map center'}</p>
      ${potentialAreaNote(spot, fi)}
      ${weatherSummaryLine}
      <p class="potential-warning-short">⚠️ ${fi?'Ei navigointiohje - tarkista virallinen kartta.':'Not for navigation - check an official chart.'}</p>
      <details class="potential-more">
        <summary class="sea-layer-summary">${fi?'Lisätietoja':'More info'}</summary>
        ${weatherBreakdown}
        <p class="potential-reason"><strong>${fi?'Miksi tämä näkyy':'Why it is shown'}:</strong> ${escapeMapHtml(spot.reason)}</p>
        <p><strong>${fi?'Mahdolliset lajit':'Potential species'}:</strong> ${escapeMapHtml(speciesText)}</p>
        <p class="potential-warning">⚠️ ${escapeMapHtml(spot.warning)} ${fi?'Tarkista aina ajantasaiset luvat ja rajoitukset.':'Always check current permits and restrictions.'}</p>
      </details>
      <div class="potential-actions">
        <button class="btn primary" type="button" id="${useId}">${fi?'Laske paikan keli':'Check conditions'}</button>
        <button class="btn" type="button" id="${favId}">${isPotentialFavorite(spot.id)?'★ '+(fi?'Suosikki':'Favorite'):'☆ '+(fi?'Tallenna':'Save')}</button>
        <a class="btn" href="https://kalastusrajoitus.fi/" target="_blank" rel="noopener">${fi?'Tarkista rajoitukset ↗':'Check restrictions ↗'}</a>
        <a class="btn" href="${escapeMapHtml(spot.sourceUrl)}" target="_blank" rel="noopener">${fi?'Avaa lähdetieto ↗':'Open source data ↗'}</a>
      </div>
    </div>`,{maxWidth:360});
    marker.on('popupopen',()=>{
      const btn=document.getElementById(useId);
      if (btn) btn.addEventListener('click',()=>usePotentialSpot(spot),{once:true});
      const fav=document.getElementById(favId);
      if (fav) fav.addEventListener('click',()=>togglePotentialFavorite(spot),{once:true});
    });
    marker.addTo(potentialSpotLayerGroup);
    potentialSpotMarkersById.set(spot.id,marker);
  });

  renderPotentialResults(visible);

  if (visible.length) {
    const weatherCount=visible.filter(s=>s.liveWeather).length;
    const weatherHint=weatherCount
      ? (fi?` Reaaliaikainen keli huomioitu ${weatherCount} kärkipisteessä.`:` Live conditions added to ${weatherCount} top spots.`) : '';
    potentialSpotStatus(
      `${visible.length}/${spots.length} vahvaa paikkaa näkyy. Paikat avattiin valmiista aineistosta ilman verkkohakua.${weatherHint}`,
      `${visible.length}/${spots.length} strong spots visible. Locations opened from bundled data without a live search.${weatherHint}`
    );
  } else {
    potentialSpotStatus(spots.length
      ? 'Yksikään paikka ei ylitä nykyistä pisterajaa. Valitse Näytä-valikosta “Myös salmet”.'
      : 'Tältä alueelta ei löytynyt vahvasti kartoitettua kalastuspaikkaa tai vesistörakennetta. Siirrä karttaa tai lähennä.',
      spots.length
      ? 'No spots meet the current threshold. Choose “Include straits” from the Show menu.'
      : 'No strongly mapped fishing place or water structure was found here. Move or zoom the map.'
    );
  }
}

function renderPotentialSpotMarkers(elements){
  if (!potentialSpotLayerGroup || !potentialSpotsWanted) return;
  potentialSpotLastElements=elements||[];
  const select=document.getElementById('potentialSpotSpecies');
  const selectedSpecies=select ? select.value : 'all';
  const spots=dedupePotentialSpots(potentialSpotLastElements.map(el=>classifyPotentialSpot(el,selectedSpecies)).filter(Boolean));
  applyPotentialWeatherFromCache(spots,selectedSpecies);
  potentialSpotLastSpots=spots;
  drawPotentialSpotMarkers(spots,potentialSpotLastElements.length);
  enrichPotentialSpotsWithWeather(spots,selectedSpecies,potentialSpotFetchToken);
}

async function loadPotentialSpotDataset(){
  if (!potentialSpotDataPromise) {
    potentialSpotDataPromise=fetch(POTENTIAL_SPOT_DATA_URL,{cache:'force-cache',credentials:'same-origin'})
      .then(res=>{
        if (!res.ok) throw new Error(`spot dataset failed: ${res.status}`);
        return res.json();
      })
      .then(data=>{
        if (!data || !Array.isArray(data.spots)) throw new Error('invalid spot dataset');
        potentialSpotDatasetMeta=data;
        return data.spots;
      })
      .catch(err=>{
        potentialSpotDataPromise=null;
        throw err;
      });
  }
  return potentialSpotDataPromise;
}

async function updatePotentialSpots(){
  if (!seaChartMap || !potentialSpotLayerGroup || !potentialSpotsWanted) return;
  const token=++potentialSpotFetchToken;

  if (seaChartMap.getZoom()<POTENTIAL_SPOT_MIN_ZOOM) {
    potentialSpotLayerGroup.clearLayers();
    potentialSpotMarkersById.clear();
    potentialSpotLastSpots=[];
    togglePotentialResultsPanel(false);
    potentialSpotStatus(
      `Lähennä karttaa tasolle ${POTENTIAL_SPOT_MIN_ZOOM} nähdäksesi paikat koko Suomesta.`,
      `Zoom to level ${POTENTIAL_SPOT_MIN_ZOOM} to see spots across Finland.`
    );
    return;
  }

  const b=seaChartMap.getBounds();
  const west=Math.max(b.getWest(),FINLAND_DATA_BOUNDS.west);
  const south=Math.max(b.getSouth(),FINLAND_DATA_BOUNDS.south);
  const east=Math.min(b.getEast(),FINLAND_DATA_BOUNDS.east);
  const north=Math.min(b.getNorth(),FINLAND_DATA_BOUNDS.north);
  if (west>=east || south>=north) {
    potentialSpotLayerGroup.clearLayers();
    potentialSpotMarkersById.clear();
    potentialSpotLastSpots=[];
    togglePotentialResultsPanel(false);
    potentialSpotStatus('Tämä tietotaso kattaa Suomen. Siirrä kartta Suomen alueelle.','This data layer covers Finland. Move the map to Finland.');
    return;
  }

  if (!potentialSpotDatasetMeta) {
    potentialSpotStatus('Avataan Suomen valmista kalapaikka-aineistoa…','Opening the bundled Finland fishing-spot data…',true);
  }
  try {
    const allElements=await loadPotentialSpotDataset();
    if (token!==potentialSpotFetchToken || !potentialSpotsWanted) return;
    const elements=allElements.filter(el=>{
      const ll=potentialElementLatLng(el);
      return ll && ll.lon>=west && ll.lon<=east && ll.lat>=south && ll.lat<=north;
    });
    renderPotentialSpotMarkers(elements);
  } catch(e) {
    if (token!==potentialSpotFetchToken || !potentialSpotsWanted) return;
    potentialSpotStatus(
      'Paikkatiedoston avaaminen epäonnistui. Päivitä sivu ja yritä uudelleen.',
      'The spot data file could not be opened. Refresh the page and try again.'
    );
  }
}

function schedulePotentialSpotUpdate(){
  if (!potentialSpotsWanted) return;
  clearTimeout(potentialSpotUpdateTimer);
  potentialSpotUpdateTimer=setTimeout(updatePotentialSpots,120);
}

function togglePotentialSpots(show){
  potentialSpotsWanted=show;
  const panel=document.getElementById('potentialSpotPanel');
  if (panel) panel.hidden=!show;
  ++potentialSpotFetchToken;
  clearTimeout(potentialSpotUpdateTimer);
  if (!show) {
    if (potentialSpotLayerGroup) potentialSpotLayerGroup.clearLayers();
    potentialSpotMarkersById.clear();
    potentialSpotLastSpots=[];
    togglePotentialResultsPanel(false);
    return;
  }
  // Näytä koko Suomen valmiit paikat heti. Käyttäjä voi tarkentaa omaan sijaintiinsa
  // erillisellä Paikanna-painikkeella, joten kartta ei käynnistä GPS:ää yllättäen.
  if (seaChartMap && seaChartMap.getZoom() < POTENTIAL_SPOT_MIN_ZOOM) {
    seaChartMap.setView([64.2,26.0],POTENTIAL_SPOT_MIN_ZOOM);
  }
  const select=document.getElementById('potentialSpotSpecies');
  if (select && select.querySelector(`option[value="${spSel.value}"]`)) select.value=spSel.value;
  updatePotentialSpots();
}

function updatePotentialSpotLanguage(){
  const fi=currentLang==='fi';
  const toggleLabel=document.getElementById('potentialSpotsToggleLabel');
  const speciesLabel=document.getElementById('potentialSpotSpeciesLabel');
  if (toggleLabel) toggleLabel.textContent=fi?'🎣 Parhaat kalapaikat':'🎣 Best fishing spots';
  if (speciesLabel) speciesLabel.textContent=fi?'Kalalaji':'Species';
  const select=document.getElementById('potentialSpotSpecies');
  if (select) {
    const value=select.value||'all';
    const options=fi
      ? [['all','Kaikki'],['ahven','Ahven'],['hauki','Hauki'],['kuha','Kuha'],['taimen','Taimen / lohi'],['siika','Siika']]
      : [['all','All'],['ahven','Perch'],['hauki','Pike'],['kuha','Zander'],['taimen','Trout / salmon'],['siika','Whitefish']];
    select.innerHTML=options.map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
    select.value=options.some(([id])=>id===value)?value:'all';
  }
  const qualityLabel=document.getElementById('potentialSpotQualityLabel');
  const quality=document.getElementById('potentialSpotQuality');
  if (qualityLabel) qualityLabel.textContent=fi?'Näytä':'Show';
  if (quality) {
    const value=quality.value||'80';
    quality.innerHTML=(fi
      ? [['80','Vahvat 80+'],['75','Myös salmet 75+'],['0','Kaikki varmennetut']]
      : [['80','Strong 80+'],['75','Include straits 75+'],['0','All verified']])
      .map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
    quality.value=value;
  }
  const legend=document.getElementById('potentialMiniLegend');
  if (legend) legend.innerHTML=fi
    ? '<span><i class="potential-legend-dot" style="background:#2f6f73"></i> 85+ erittäin lupaava</span><span><i class="potential-legend-dot" style="background:#d5752c"></i> 70–84 hyvä</span><span><i class="potential-legend-dot" style="background:#6e7772"></i> tutkittava</span><span><i class="potential-legend-dot" style="background:#fff;border:2px solid #2f6f73"></i> valkoinen kehä = keli mukana</span>'
    : '<span><i class="potential-legend-dot" style="background:#2f6f73"></i> 85+ very promising</span><span><i class="potential-legend-dot" style="background:#d5752c"></i> 70–84 good</span><span><i class="potential-legend-dot" style="background:#6e7772"></i> investigate</span><span><i class="potential-legend-dot" style="background:#fff;border:2px solid #2f6f73"></i> white ring = live conditions</span>';
  const resultsTitle=document.getElementById('potentialResultsTitle');
  const resultsClose=document.getElementById('potentialResultsClose');
  if (resultsTitle) resultsTitle.textContent=fi?'Parhaat paikat':'Top spots';
  if (resultsClose) resultsClose.setAttribute('aria-label',fi?'Sulje lista':'Close list');
  const resultsPanel=document.getElementById('potentialResultsPanel');
  togglePotentialResultsPanel(resultsPanel ? !resultsPanel.hidden : false);
  if (potentialSpotsWanted) schedulePotentialSpotUpdate();
  else potentialSpotStatus('Valmis aineisto avautuu ilman verkkohakua.','Bundled data opens without a live search.');
}

async function fetchWaterPolygons(bbox){
  const [minLon,minLat,maxLon,maxLat] = bbox;
  const box = `${minLat},${minLon},${maxLat},${maxLon}`;
  const q = `[out:json][timeout:20];(way["natural"="water"](${box});way["waterway"="riverbank"](${box});way["natural"="bay"](${box});relation["natural"="water"](${box}););out geom;`;
  let lastErr = null;
  let data = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(endpoint, { method:'POST', body: q, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) { lastErr = new Error('overpass fetch failed: ' + res.status); continue; }
      data = await res.json();
      break;
    } catch(e) {
      clearTimeout(timeoutId);
      lastErr = e;
    }
  }
  if (!data) throw lastErr || new Error('overpass fetch failed');
  const polygons = [];
  (data.elements||[]).forEach(el => {
    if (el.type === 'way' && el.geometry && el.geometry.length > 2) {
      polygons.push(el.geometry.map(g => [g.lat, g.lon]));
    } else if (el.type === 'relation' && el.members) {
      el.members.forEach(m => {
        if (m.geometry && m.geometry.length > 2) polygons.push(m.geometry.map(g => [g.lat, g.lon]));
      });
    }
  });
  return polygons;
}

async function fetchHazardPoints(bbox){
  try {
    const data = await fetchVaylapilviCollection('vesivaylatiedot:turvalaitteet_uusi', bbox, 500);
    return (data.features||[])
      .filter(f => isHazardMark(f.properties||{}))
      .map(f => f.geometry && f.geometry.coordinates && f.geometry.coordinates[0])
      .filter(Boolean)
      .map(c => ({ lat:c[1], lng:c[0] }));
  } catch(e) { return []; }
}

const OPEN_WATER_MAX_STRAIGHT_M = 60000; // liian iso alue tekisi ruudukkolaskennasta liian raskaan/hitaan selaimessa
const OPEN_WATER_TARGET_CELLS = 3000;
const OPEN_WATER_MIN_CELL_M = 40;
const OPEN_WATER_MAX_CELL_M = 600;
const HAZARD_BUFFER_M = 120;      // karimerkin lähietäisyys - reitti välttää voimakkaasti
const HAZARD_SOFT_BUFFER_M = 300; // laajempi vyöhyke - reitti kalliimpi mutta ei estetty

function buildOpenWaterGrid(bbox, polygons, hazards){
  const [minLon,minLat,maxLon,maxLat] = bbox;
  const midLat = (minLat+maxLat)/2;
  const mLat = metersPerDegLat(), mLng = metersPerDegLng(midLat);
  const widthM = (maxLon-minLon) * mLng;
  const heightM = (maxLat-minLat) * mLat;
  let cellM = Math.sqrt((widthM*heightM) / OPEN_WATER_TARGET_CELLS) || OPEN_WATER_MIN_CELL_M;
  cellM = Math.min(OPEN_WATER_MAX_CELL_M, Math.max(OPEN_WATER_MIN_CELL_M, cellM));
  const cols = Math.max(2, Math.min(70, Math.ceil(widthM / cellM)));
  const rows = Math.max(2, Math.min(70, Math.ceil(heightM / cellM)));
  const dLng = (maxLon-minLon)/cols, dLat = (maxLat-minLat)/rows;

  const water = new Uint8Array(cols*rows);
  const cost = new Float32Array(cols*rows).fill(1);
  let waterCount = 0;
  for (let r=0; r<rows; r++){
    for (let c=0; c<cols; c++){
      const lat = minLat + (r+0.5)*dLat;
      const lng = minLon + (c+0.5)*dLng;
      const idx = r*cols+c;
      if (pointInAnyPolygon(lat, lng, polygons)) { water[idx]=1; waterCount++; }
    }
  }
  if (waterCount === 0) return null;

  hazards.forEach(h => {
    const rc = Math.round((h.lat-minLat)/dLat), cc = Math.round((h.lng-minLon)/dLng);
    const rSoft = Math.max(1, Math.ceil(HAZARD_SOFT_BUFFER_M / Math.min(dLat*mLat, dLng*mLng)));
    for (let r=rc-rSoft; r<=rc+rSoft; r++){
      for (let c=cc-rSoft; c<=cc+rSoft; c++){
        if (r<0||r>=rows||c<0||c>=cols) continue;
        const idx=r*cols+c;
        if (!water[idx]) continue;
        const lat = minLat + (r+0.5)*dLat, lng = minLon + (c+0.5)*dLng;
        const distM = haversineMeters(L.latLng(h.lat,h.lng), L.latLng(lat,lng));
        if (distM <= HAZARD_BUFFER_M) cost[idx] = Math.max(cost[idx], 40);
        else if (distM <= HAZARD_SOFT_BUFFER_M) cost[idx] = Math.max(cost[idx], 6);
      }
    }
  });

  return { cols, rows, minLon, minLat, dLng, dLat, mLat, mLng, water, cost };
}

function gridCellIndex(grid, lat, lng){
  const c = Math.floor((lng-grid.minLon)/grid.dLng);
  const r = Math.floor((lat-grid.minLat)/grid.dLat);
  if (c<0||c>=grid.cols||r<0||r>=grid.rows) return null;
  return { r, c, idx: r*grid.cols+c };
}
function nearestWaterCell(grid, lat, lng, maxRing){
  const center = gridCellIndex(grid, lat, lng);
  if (!center) return null;
  if (grid.water[center.idx]) return center;
  for (let rad=1; rad<=maxRing; rad++){
    for (let dr=-rad; dr<=rad; dr++){
      for (let dc=-rad; dc<=rad; dc++){
        if (Math.max(Math.abs(dr),Math.abs(dc)) !== rad) continue;
        const r=center.r+dr, c=center.c+dc;
        if (r<0||r>=grid.rows||c<0||c>=grid.cols) continue;
        const idx=r*grid.cols+c;
        if (grid.water[idx]) return { r, c, idx };
      }
    }
  }
  return null;
}

// Sama yksinkertainen O(n^2) Dijkstra-tyyli kuin dijkstraRoute():ssa yllä - ruudukko on
// tarkoituksella rajattu pieneksi (enintään 70x70), jotta tämä pysyy nopeana selaimessa.
function gridAStarRoute(grid, start, end){
  const cols=grid.cols, total=grid.cols*grid.rows;
  const cellW = grid.dLng*grid.mLng, cellH = grid.dLat*grid.mLat;
  const dist = new Float64Array(total).fill(Infinity);
  const visited = new Uint8Array(total);
  const prev = new Int32Array(total).fill(-1);
  dist[start.idx] = 0;
  const neighbors = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  for (let iter=0; iter<total; iter++){
    let u=-1, best=Infinity;
    for (let i=0;i<total;i++){ if (!visited[i] && dist[i]<best){ best=dist[i]; u=i; } }
    if (u===-1) break;
    if (u===end.idx) break;
    visited[u]=1;
    const ur=Math.floor(u/cols), uc=u%cols;
    for (const [dr,dc] of neighbors){
      const r=ur+dr, c=uc+dc;
      if (r<0||r>=grid.rows||c<0||c>=grid.cols) continue;
      const idx=r*cols+c;
      if (!grid.water[idx] || visited[idx]) continue;
      const stepM = Math.sqrt((dr*cellH)*(dr*cellH) + (dc*cellW)*(dc*cellW));
      const w = stepM * ((grid.cost[u]+grid.cost[idx])/2);
      const nd = dist[u] + w;
      if (nd < dist[idx]) { dist[idx]=nd; prev[idx]=u; }
    }
  }
  if (dist[end.idx] === Infinity) return null;
  const path=[]; let cur=end.idx;
  while (true){ path.unshift(cur); if (cur===start.idx) break; cur=prev[cur]; if (cur===-1) return null; }
  const latlngs = path.map(idx => {
    const r=Math.floor(idx/cols), c=idx%cols;
    return L.latLng(grid.minLat+(r+0.5)*grid.dLat, grid.minLon+(c+0.5)*grid.dLng);
  });
  return { latlngs, totalMeters: dist[end.idx] };
}

function drawOpenWaterRouteInfo(km){
  const infoEl=document.getElementById("seaRouteInfo");
  if (!infoEl) return;
  infoEl.hidden = false;
  infoEl.innerHTML = `<h4>⚠️ Avoveden reitti (arvio): ${km} km</h4><ul>
    <li><strong>Ei kulje merkittyä väylää pitkin.</strong> Reitti on laskettu avoimen vesialuedatan ja tunnettujen karimerkkien perusteella - se EI sisällä syvyystietoa eikä kaikkia kartoittamattomia kiviä ja matalikkoja, varsinkaan pienillä sisäjärvillä joilta ei ole virallista syvyyskartoitusta.</li>
    <li>Käytä vain karkeana suunnitteluapuna. Aja hitaasti ja tarkkaile vettä erityisesti rantojen ja saarten lähellä. Tarkista aina paikalliset olosuhteet ennen lähtöä.</li>
  </ul>`;
}

let seaRoutePlacing = null; // 'start' | 'end' | null - mikä piste asetetaan seuraavalla klikkauksella

function updateSeaRouteButtons(){
  const startBtn=document.getElementById("seaSetStartBtn");
  const endBtn=document.getElementById("seaSetEndBtn");
  if (startBtn) startBtn.classList.toggle("armed", seaRoutePlacing==='start');
  if (endBtn) endBtn.classList.toggle("armed", seaRoutePlacing==='end');
}

function armSeaRoutePlacement(which){
  seaRoutePlacing = which;
  updateSeaRouteButtons();
  const statusEl=document.getElementById("seaRouteStatus");
  if (statusEl) statusEl.textContent = which==='start'
    ? "Klikkaa kartalta lähtöpaikka."
    : "Klikkaa kartalta määränpää.";
}

function clearSeaRoute(){
  if (seaRoute.startMarker) seaChartMap.removeLayer(seaRoute.startMarker);
  if (seaRoute.endMarker) seaChartMap.removeLayer(seaRoute.endMarker);
  if (seaRoute.routeLayer) seaChartMap.removeLayer(seaRoute.routeLayer);
  seaRoute = { startLatLng:null, endLatLng:null, startMarker:null, endMarker:null, routeLayer:null };
  seaRoutePlacing = null;
  updateSeaRouteButtons();
  const statusEl=document.getElementById("seaRouteStatus");
  if (statusEl) statusEl.textContent = 'Valitse "Lähtöpaikka", sitten klikkaa kartalta.';
  const infoEl=document.getElementById("seaRouteInfo");
  if (infoEl) { infoEl.hidden = true; infoEl.innerHTML=''; }
}

// Tumma "halo"-ääriviiva värillisen reittiviivan alla tekee reitistä selvästi erottuvan
// kirjavan pohjakartan, väyläalueiden ja turvalaitemerkkien seasta - ilman haloa ohut
// värillinen viiva hukkui helposti muun tason alle ja karttaa oli vaikea lukea.
function drawHaloRoute(latlngs, lineOptions){
  const group = L.layerGroup();
  L.polyline(latlngs, {
    color:'#12201d', weight: lineOptions.weight + 4, opacity:.55,
    dashArray: lineOptions.dashArray, lineCap:'round', lineJoin:'round'
  }).addTo(group);
  L.polyline(latlngs, Object.assign({ lineCap:'round', lineJoin:'round' }, lineOptions)).addTo(group);
  group.addTo(seaChartMap);
  return group;
}

async function computeAndDrawRoute(){
  const statusEl=document.getElementById("seaRouteStatus");
  if (!seaRoute.startLatLng || !seaRoute.endLatLng) return;
  if (statusEl) statusEl.textContent = "Haetaan väylätietoja ja lasketaan reittiä...";

  const straightDistanceM = haversineMeters(seaRoute.startLatLng, seaRoute.endLatLng);
  const pad = Math.min(0.6, Math.max(0.15, straightDistanceM / 90000));
  const lats=[seaRoute.startLatLng.lat, seaRoute.endLatLng.lat];
  const lngs=[seaRoute.startLatLng.lng, seaRoute.endLatLng.lng];
  const bbox=[Math.min.apply(null,lngs)-pad, Math.min.apply(null,lats)-pad, Math.max.apply(null,lngs)+pad, Math.max.apply(null,lats)+pad];

  let graphResult, fetchFailed=false;
  try {
    graphResult = await buildRouteGraph(bbox);
  } catch(e) {
    fetchFailed = true;
  }

  const MAX_SNAP_M = 1500;
  let result=null, startNode=null, endNode=null;
  if (graphResult) {
    startNode = findNearestRouteNode(graphResult.nodeLatLng, seaRoute.startLatLng, MAX_SNAP_M);
    endNode = findNearestRouteNode(graphResult.nodeLatLng, seaRoute.endLatLng, MAX_SNAP_M);
    if (startNode && endNode) {
      result = dijkstraRoute(graphResult.graph, startNode.key, endNode.key);
    }
  }

  if (seaRoute.routeLayer) seaChartMap.removeLayer(seaRoute.routeLayer);

  if (result) {
    const allLatLngs = [];
    result.edges.forEach(e => { e.coords.forEach(c => allLatLngs.push(c)); });
    seaRoute.routeLayer = drawHaloRoute(allLatLngs, { color:'#f5c518', weight:5, opacity:1 });
    const km = (result.totalMeters/1000).toFixed(1);
    if (statusEl) statusEl.textContent = `Reitti löytyi: ${km} km merkittyjä väyliä pitkin.`;
    drawRouteInfo(km, result.edges.length, false);
    return;
  }

  // Ei yhtenäistä merkittyä väylää pisteiden välillä - yritetään avoveden ruudukkoreititystä
  // (ks. yllä oleva laaja kommentti buildOpenWaterGrid-lohkon yhteydessä). Tämä on tarkoituksella
  // toissijainen: merkittyä väylää käytetään aina kun sellainen löytyy.
  if (statusEl) statusEl.textContent = "Ei merkittyä väylää - lasketaan avoveden reittiä...";
  let gridRouteResult = null;
  if (straightDistanceM <= OPEN_WATER_MAX_STRAIGHT_M) {
    try {
      // Oma, matkan pituuteen suhteutettu bbox-marginaali - väylägraafin haku yllä käyttää
      // tarkoituksella suurta minimimarginaalia (0.15°) jotta kaukanakin oleva väylä löytyy,
      // mutta ruudukkoreitityksessä sama marginaali tekisi lyhyestä sisäjärvireitistä turhan
      // karkean (pieni järvi voi kadota ruudukon otantavälien väliin). Siksi pienemmillä
      // etäisyyksillä käytetään paljon tiukempaa rajausta.
      const gridPad = Math.min(0.3, Math.max(0.008, straightDistanceM / 55000));
      const gridBbox = [
        Math.min.apply(null, lngs) - gridPad, Math.min.apply(null, lats) - gridPad,
        Math.max.apply(null, lngs) + gridPad, Math.max.apply(null, lats) + gridPad
      ];
      const [polygons, hazards] = await Promise.all([
        fetchWaterPolygons(gridBbox),
        fetchHazardPoints(gridBbox)
      ]);
      const grid = buildOpenWaterGrid(gridBbox, polygons, hazards);
      if (grid) {
        const startCell = nearestWaterCell(grid, seaRoute.startLatLng.lat, seaRoute.startLatLng.lng, 6);
        const endCell = nearestWaterCell(grid, seaRoute.endLatLng.lat, seaRoute.endLatLng.lng, 6);
        if (startCell && endCell) {
          gridRouteResult = gridAStarRoute(grid, startCell, endCell);
        }
      }
    } catch(e) {
      // Overpass-haku epäonnistui tms. - jatketaan alla suoraan viivaan, ei kaadeta karttaa.
    }
  }

  if (gridRouteResult) {
    const latlngs = [seaRoute.startLatLng, ...gridRouteResult.latlngs, seaRoute.endLatLng];
    seaRoute.routeLayer = drawHaloRoute(latlngs, { color:'#e08f1f', weight:5, opacity:1, dashArray:'2 10' });
    const openKm = (gridRouteResult.totalMeters/1000).toFixed(1);
    if (statusEl) statusEl.textContent = `Avoveden reitti (arvio): ${openKm} km - ei merkittyä väylää.`;
    drawOpenWaterRouteInfo(openKm);
    return;
  }

  // Ei yhtenäistä merkittyä väylää eikä avoveden ruudukkoreittiä pisteiden välillä - piirretään
  // suora "linnuntietä"-yhteys selvästi eri tyylillä (katkoviiva) eikä koskaan väylä-reittinä.
  // Tämä ei ole reittiehdotus, vain karkea etäisyys/suuntaviiva - ei huomioi syvyyttä, kareja
  // tai matalikkoja lainkaan.
  seaRoute.routeLayer = drawHaloRoute([seaRoute.startLatLng, seaRoute.endLatLng], {
    color:'#8a8f96', weight:3, opacity:1, dashArray:'8 8'
  });
  const straightKm = (straightDistanceM/1000).toFixed(1);
  if (statusEl) statusEl.textContent = fetchFailed
    ? "Väylätietojen haku epäonnistui - näytetään vain suora yhteys."
    : `Ei merkittyä väylää pisteiden välillä - näytetään suora yhteys (${straightKm} km).`;
  drawRouteInfo(straightKm, 0, true);
}

function drawRouteInfo(km, segmentCount, isStraightFallback){
  const infoEl=document.getElementById("seaRouteInfo");
  if (!infoEl) return;
  infoEl.hidden = false;
  if (isStraightFallback) {
    infoEl.innerHTML = `<h4>Suora yhteys: ${km} km</h4><ul><li><strong>Ei kulje merkittyä väylää pitkin.</strong> Tämä on vain suora linnuntie-etäisyys pisteiden välillä - ei huomioi syvyyttä, kareja, matalikkoja eikä väyliä.</li><li>Käytä vain karkeana etäisyysarviona. Suunnittele oikea reitti virallisista merikartoista.</li></ul>`;
  } else {
    infoEl.innerHTML = `<h4>Nopein reitti merkittyjä väyliä pitkin: ${km} km</h4><ul><li>Kulkee ${segmentCount} navigointilinjan kautta - pysyy koko matkan virallisesti merkityillä väylillä, ei vapaan veden läpi.</li><li>Suuntatieto (miltä puolelta ohittaa kukin merkki) ei ole vielä saatavilla - tarkista merkkien ohitussuunta virallisista merikartoista ennen lähtöä.</li></ul>`;
  }
}

function onSeaChartMapClick(latlng){
  const statusEl=document.getElementById("seaRouteStatus");
  if (seaRoutePlacing === 'start') {
    if (seaRoute.startMarker) seaChartMap.removeLayer(seaRoute.startMarker);
    seaRoute.startLatLng = latlng;
    seaRoute.startMarker = L.marker(latlng, { icon: L.divIcon({className:'', html:'<div class="sea-start-marker"></div>', iconSize:[26,26], iconAnchor:[13,26]}) }).addTo(seaChartMap);
    seaRoutePlacing = null;
    updateSeaRouteButtons();
    if (statusEl) statusEl.textContent = seaRoute.endLatLng ? "Lasketaan reittiä..." : 'Lähtöpaikka asetettu. Valitse "Määränpää".';
    if (seaRoute.endLatLng) computeAndDrawRoute();
  } else if (seaRoutePlacing === 'end') {
    if (seaRoute.endMarker) seaChartMap.removeLayer(seaRoute.endMarker);
    seaRoute.endLatLng = latlng;
    seaRoute.endMarker = L.marker(latlng, { icon: L.divIcon({className:'', html:'<div class="sea-end-marker"></div>', iconSize:[26,26], iconAnchor:[13,26]}) }).addTo(seaChartMap);
    seaRoutePlacing = null;
    updateSeaRouteButtons();
    if (statusEl) statusEl.textContent = seaRoute.startLatLng ? "Lasketaan reittiä..." : 'Määränpää asetettu. Valitse "Lähtöpaikka".';
    if (seaRoute.startLatLng) computeAndDrawRoute();
  }
}

(function(){
  const toggle=document.getElementById("seamarkToggle");
  if (toggle) toggle.addEventListener("change",()=>toggleSeaChartSeamarks(toggle.checked));
  const officialToggle=document.getElementById("officialLayerToggle");
  if (officialToggle) officialToggle.addEventListener("change",()=>toggleOfficialLayers(officialToggle.checked));
  [["layerFairwayLines","lines"],["layerFairwayAreaOutline","areaOutline"],["layerSpeedZones","speedZones"],["layerEquipment","equipment"]].forEach(([id,key])=>{
    const el=document.getElementById(id);
    if (el) el.addEventListener("change",()=>{ officialSubLayers[key]=el.checked; updateOfficialLayers(); });
  });
  [["hudShowSpeed","speed"],["hudShowWind","wind"],["hudShowTemp","temp"],["hudShowWave","wave"]].forEach(([id,key])=>{
    const el=document.getElementById(id);
    const chip=document.querySelector(`.condition-chip[data-hud="${key}"]`);
    if (el && chip) el.addEventListener("change",()=>{ chip.classList.toggle("sea-panel-hidden", !el.checked); });
  });
  const potentialToggle=document.getElementById("potentialSpotsToggle");
  if (potentialToggle) potentialToggle.addEventListener("change",()=>togglePotentialSpots(potentialToggle.checked));
  const potentialSpecies=document.getElementById("potentialSpotSpecies");
  if (potentialSpecies) potentialSpecies.addEventListener("change",()=>{
    if (potentialSpotsWanted) updatePotentialSpots();
  });
  const potentialQuality=document.getElementById("potentialSpotQuality");
  if (potentialQuality) potentialQuality.addEventListener("change",()=>{
    if (potentialSpotsWanted && potentialSpotLastElements.length) renderPotentialSpotMarkers(potentialSpotLastElements);
  });
  const potentialResultsToggle=document.getElementById("potentialResultsToggle");
  if (potentialResultsToggle) potentialResultsToggle.addEventListener("click",()=>{
    const panel=document.getElementById("potentialResultsPanel");
    togglePotentialResultsPanel(panel ? panel.hidden : true,true);
  });
  const potentialResultsClose=document.getElementById("potentialResultsClose");
  if (potentialResultsClose) potentialResultsClose.addEventListener("click",()=>togglePotentialResultsPanel(false,true));
  const locateBtn=document.getElementById("seaChartLocateBtn");
  if (locateBtn) locateBtn.addEventListener("click",locateSeaChart);
  const clearRouteBtn=document.getElementById("seaRouteClearBtn");
  if (clearRouteBtn) clearRouteBtn.addEventListener("click",clearSeaRoute);
  const setStartBtn=document.getElementById("seaSetStartBtn");
  if (setStartBtn) setStartBtn.addEventListener("click",()=>armSeaRoutePlacement('start'));
  const setEndBtn=document.getElementById("seaSetEndBtn");
  if (setEndBtn) setEndBtn.addEventListener("click",()=>armSeaRoutePlacement('end'));

  const disclaimerToggle=document.getElementById("seaDisclaimerToggle");
  if (disclaimerToggle) disclaimerToggle.addEventListener("click",()=>{
    const wrap=document.getElementById("seaChartDisclaimer");
    const detail=document.getElementById("seaDisclaimerDetail");
    const expanded = wrap.classList.toggle("expanded");
    detail.hidden = !expanded;
    const toolbar=document.getElementById("seaChartToolbar");
    if (toolbar) toolbar.style.top = (wrap.offsetHeight + 4) + "px";
  });

  // Varoituksen voi kutistaa pieneksi merkiksi ("älä näytä enää") mutta ei poistaa kokonaan -
  // aineiston julkaisija (Väylävirasto/Traficom) toteaa itse ettei data sovellu
  // navigointikäyttöön, joten jonkin pysyvän merkinnän pitää aina olla näkyvissä.
  const dismissBtn=document.getElementById("seaDisclaimerDismissBtn");
  const badge=document.getElementById("seaDisclaimerBadge");
  const disclaimerWrap=document.getElementById("seaChartDisclaimer");
  function setDisclaimerDismissed(dismissed){
    storage.setItem('sea_chart_disclaimer_dismissed', dismissed ? '1' : '0');
    if (disclaimerWrap) disclaimerWrap.hidden = dismissed;
    if (badge) badge.hidden = !dismissed;
    const toolbar=document.getElementById("seaChartToolbar");
    if (toolbar) toolbar.style.top = dismissed ? "12px" : (disclaimerWrap.offsetHeight + 4) + "px";
  }
  if (dismissBtn) dismissBtn.addEventListener("click", () => setDisclaimerDismissed(true));
  if (badge) badge.addEventListener("click", () => setDisclaimerDismissed(false));
  if (storage.getItem('sea_chart_disclaimer_dismissed') === '1') setDisclaimerDismissed(true);

  const activateBtn=document.getElementById("seaChartActivateBtn");
  if (activateBtn) activateBtn.addEventListener("click", enterSeaChartFullscreen);
  const closeBtn=document.getElementById("seaChartCloseBtn");
  if (closeBtn) closeBtn.addEventListener("click", exitSeaChartFullscreen);
  const toolbarCloseBtn=document.getElementById("seaToolbarCloseBtn");
  if (toolbarCloseBtn) toolbarCloseBtn.addEventListener("click", () => setSeaPanelHidden("seaChartToolbar", "seaToolbarReopenBtn", true));
  const toolbarReopenBtn=document.getElementById("seaToolbarReopenBtn");
  if (toolbarReopenBtn) toolbarReopenBtn.addEventListener("click", () => setSeaPanelHidden("seaChartToolbar", "seaToolbarReopenBtn", false));
  const hudCloseBtn=document.getElementById("seaHudCloseBtn");
  if (hudCloseBtn) hudCloseBtn.addEventListener("click", () => setSeaPanelHidden("seaChartBottomLeft", "seaHudReopenBtn", true));
  const hudReopenBtn=document.getElementById("seaHudReopenBtn");
  if (hudReopenBtn) hudReopenBtn.addEventListener("click", () => setSeaPanelHidden("seaChartBottomLeft", "seaHudReopenBtn", false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const wrap=document.getElementById("seaChartWrap");
      if (wrap && wrap.classList.contains("sea-chart-maximized")) exitSeaChartFullscreen();
    }
  });
})();

function renderNearbySpots(spots, userLat, userLon){
  renderNearbySpots.lastSpots = spots;
  renderNearbySpots.lastLat = userLat;
  renderNearbySpots.lastLon = userLon;
  const grid=document.getElementById("nearbyGrid");
  const statusEl = document.getElementById("nearbyStatus");
  if (statusEl) {
    statusEl.textContent = currentLang === 'fi' 
      ? "Suoraan Open-Meteon säädatasta lasketut kelipisteet juuri nyt lähialueellasi."
      : "Bite scores calculated directly from Open-Meteo weather data near you right now.";
  }

  const biteLabel = currentLang === 'fi' ? 'keli juuri nyt' : 'conditions right now';
  const primeLabel = currentLang === 'fi' ? 'hämärän syönti-ikkuna päällä' : 'twilight feeding window active';
  const useBtn = currentLang === 'fi' ? 'Käytä tätä paikkaa' : 'Use this spot';

  renderNearbyMap(spots, userLat, userLon);

  if (grid) {
    grid.innerHTML=spots.map((s,i)=>{
      const lbl=scoreLabel(s.score);
      return `<article class="tip-card spot-card" data-idx="${i}">
        <div class="spot-top">
          <div><span class="tag">${fmtKm(s.distance)}</span><h3 class="spot-title">${s.name}</h3></div>
          <div class="spot-score" style="background:${lbl.color}">${s.score}</div>
        </div>
        <p>${lbl.text} ${biteLabel}${s.isPrimeTime?" · "+primeLabel:""}.</p>
        ${renderWaterInfo(s.name)}
        ${renderStructureHints(s.name)}
        ${renderCitySpots(s.name)}
        <button class="btn primary" data-spot="${i}">${useBtn}</button>
      </article>`;
    }).join("");
    grid.querySelectorAll("button[data-spot]").forEach(b=>b.addEventListener("click",()=>{
      useNearbySpot(spots[b.dataset.spot]);
    }));
  }
}
function isCoordsInFinland(lat, lon) {
  // Finland geographical bounding box approximate boundaries:
  return (lat >= 59.3 && lat <= 70.2 && lon >= 19.0 && lon <= 31.6);
}
async function loadNearbySpots(userLat,userLon){
  try {
    // Check if we should automatically switch language based on coordinates
    const manualLang = storage.getItem('user_language');
    if (!manualLang) {
      const inFinland = isCoordsInFinland(userLat, userLon);
      if (inFinland) {
        setLanguage('fi', false); // Keep or set to FI automatically, don't write to local storage as manual override
      } else {
        setLanguage('en', false); // Switch to EN automatically
      }
    }

    // Tunnistetaan käyttäjän maa taustalla ja suodatetaan kalalajivalikko sen mukaan,
    // kun mahdollista (esim. Ranskassa näytetään lajit joita siellä yleisesti esiintyy).
    // Ei estetä muun sivun latautumista - päivitetään valikko heti kun vastaus saapuu.
    detectCountryCode(userLat, userLon).then(cc => {
      if (cc) {
        detectedCountryCode = cc;
        applyCountrySpeciesFilter();
      }
    });

    const meName = currentLang === 'fi' ? "Oma sijaintisi" : "Your Location";
    const mePoint = {name: meName, lat:userLat, lon:userLon, distance:0};

    // Lasketaan etäisyys jokaiseen oikeaan järveen/lampeen/merialueeseen LOCATIONS-listasta
    const byDistance = LOCATIONS
      .map(l=>({name:l.name, lat:l.lat, lon:l.lon, distance:haversineKm(userLat,userLon,l.lat,l.lon)}))
      .sort((a,b)=>a.distance-b.distance);

    // Lähin oikea kalapaikka lisätään listalle valittavaksi vaihtoehdoksi
    const nearestReal = byDistance[0] || mePoint;
    addDynamicLocation(nearestReal);
    // Käyttäjän tarkka oma sijainti lisätään listan kärkeen ja asetetaan oletukseksi
    const meKey = addDynamicLocation(mePoint);
    locSel.value=meKey;
    refresh();

    const statusEl = document.getElementById("nearbyStatus");
    if (statusEl) {
      statusEl.textContent = currentLang === 'fi' 
        ? "Haetaan säätietoja lähimmiltä kalapaikoiltasi Open-Meteolta..." 
        : "Fetching weather data for your nearest fishing spots from Open-Meteo...";
    }

    const CANDIDATE_COUNT=12;
    const candidates=byDistance.slice(0,CANDIDATE_COUNT);
    const points=[mePoint, ...candidates];

    const dataArr=await fetchWeatherBatch(points);
    const species=spSel.value;
    const scored=points.map((p,i)=>{
      const data=dataArr[i];
      if (!data || !data.hourly) {
        throw new Error("Missing weather hourly data");
      }
      const idx=nearestHourIndex(data.hourly.time);
      const info=computeScore(data,idx,species,p);
      return {...p,score:info.score,isPrimeTime:info.isPrimeTime};
    });

    // Näytetään oikeasti LÄHIMMÄT kalapaikat (sekoitus järviä/jokia/merta), ei vain parhaiten pisteytettyjä -
    // muuten esim. lähellä olevat järvet voivat hukkua listalta jos meri sattuu pisteytymään korkeammalle juuri nyt.
    const realSpots=scored.filter(s=>s.distance>0).sort((a,b)=>a.distance-b.distance).slice(0,NEARBY_SHOW_COUNT);

    renderNearbySpots(realSpots, userLat, userLon);

  } catch(err) {
    console.error("loadNearbySpots failed:", err);
    renderNearbyError(currentLang === 'fi' 
      ? "Lähialueen kelien laskenta ei onnistunut juuri nyt. Voit silti valita paikan käsin yllä."
      : "Could not calculate bite index for your local area right now. You can still select a spot manually above.");
  }
}
let nearbyGeoLoading = false;
function renderGeoLocationOptIn(){
  const section = document.getElementById("nearbySection");
  const statusEl = document.getElementById("nearbyStatus");
  if (!section || !("geolocation" in navigator)) {
    if (section) section.hidden = true;
    return;
  }
  const isKelimittariActive = document.getElementById("kelimittari")?.classList.contains("active");
  section.hidden = !isKelimittariActive;
  if (!statusEl || renderNearbySpots.lastSpots) return;
  const label = currentLang === 'fi' ? 'Käytä sijaintiani' : 'Use my location';
  const copy = currentLang === 'fi'
    ? 'Lähikalapaikat tarvitsevat erillisen selaimen sijaintiluvan. Mainos- tai evästesuostumus ei anna FastFishingille sijaintilupaa.'
    : 'Nearby fishing spots need a separate browser location permission. Ad or cookie consent does not grant FastFishing location access.';
  statusEl.innerHTML = `${copy} <button type="button" class="btn" id="nearbyLocationBtn" style="margin-left:8px;min-height:38px;padding:7px 13px;">${label}</button>`;
  document.getElementById("nearbyLocationBtn")?.addEventListener("click", () => initGeoLocation(true), { once:true });
}

async function initGeoLocation(requestPermission = false){
  try {
    const section = document.getElementById("nearbySection");
    if (!("geolocation" in navigator) || !navigator.geolocation) {
      if (section) section.hidden = true;
      return;
    }

    const isKelimittariActive = document.getElementById("kelimittari")?.classList.contains("active");
    if (section) section.hidden = !isKelimittariActive;

    if (!requestPermission) {
      let permissionState = 'prompt';
      try {
        if (navigator.permissions?.query) {
          const permission = await navigator.permissions.query({ name: 'geolocation' });
          permissionState = permission.state;
        }
      } catch(e) {}
      if (permissionState !== 'granted') {
        renderGeoLocationOptIn();
        return;
      }
    }

    if (nearbyGeoLoading) return;
    nearbyGeoLoading = true;
    const statusEl = document.getElementById("nearbyStatus");
    if (statusEl) {
      statusEl.textContent = currentLang === 'fi'
        ? "Haetaan sijaintiasi selaimelta..."
        : "Locating your position in browser...";
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        nearbyGeoLoading = false;
        try {
          loadNearbySpots(pos.coords.latitude, pos.coords.longitude);
        } catch (err) {
          console.error("getCurrentPosition success handler exception:", err);
        }
      },
      () => {
        nearbyGeoLoading = false;
        const statusEl2 = document.getElementById("nearbyStatus");
        if (statusEl2) {
          statusEl2.textContent = currentLang === 'fi'
            ? "Sijaintia ei saatu käyttöön. Salli sijainti selaimen sivustoasetuksista tai valitse paikka käsin yllä olevasta listasta."
            : "Location could not be acquired. Allow location in your browser site settings or choose a place manually above.";
        }
        const gridEl = document.getElementById("nearbyGrid");
        if (gridEl) gridEl.innerHTML = "";
      },
      {enableHighAccuracy:false, timeout:8000, maximumAge:600000}
    );
  } catch (err) {
    nearbyGeoLoading = false;
    console.error("initGeoLocation exception:", err);
  }
}

function showPage(id){
  const tabId = id === "uistinDetail" ? "uistimet" : id;
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===id));
  document.querySelectorAll(".tab-btn").forEach(b=>b.classList.toggle("active",b.dataset.page===tabId));
  document.querySelectorAll(".mobile-nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===tabId));
  const hero = document.querySelector(".hero");
  hero.classList.toggle("hero-solo", id!=="kelimittari");
  hero.classList.toggle("hero-feed-hidden", id==="feedi");

  const section = document.getElementById("nearbySection");
  if (section) {
    if (id === 'kelimittari' && ("geolocation" in navigator)) {
      section.hidden = false;
      if (!renderNearbySpots.lastSpots) initGeoLocation(false);
      if (nearbyMap) setTimeout(()=>nearbyMap.invalidateSize(), 50);
    } else {
      section.hidden = true;
    }
  }

  if (id === 'merikartta') {
    renderSeaChart();
    ensureMapAnalysisModules().catch(()=>{
      potentialSpotStatus(
        'Kartta toimii, mutta osa valinnaisista rakenneaineistoista ei latautunut. Yritä avata kartta uudelleen.',
        'The map works, but some optional structure layers did not load. Try opening the map again.'
      );
    });
  }
  if (id === 'feedi') {
    initFeedPage();
  }

  const page = document.getElementById(id);
  if(page) page.scrollIntoView({block:"start"});
}
document.querySelectorAll("[data-page]").forEach(btn=>btn.addEventListener("click",()=>showPage(btn.dataset.page)));
document.querySelectorAll("[data-go]").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();showPage(a.dataset.go)}));

// --- Saalisfeedi: käyttäjätilit, kuvan lataus, feedin selaus -------------------------------
let feedUser = null;
let feedAuthMode = 'login'; // 'login' | 'signup'
let feedAuthExpanded = false;
let feedCursor = null;      // pienin tähän mennessä ladattu postauksen id (sivutus)
let feedHasMore = true;
let feedLoading = false;
let feedPosts = [];
let feedApiOffline = false; // tosi jos palvelinta ei ole määritetty tai se ei vastaa

// Saalisfeedin palvelin voi olla eri osoitteessa kuin itse sivusto: GitHub Pages tarjoilee vain
// staattisia tiedostoja, joten API ajetaan muualla (ks. feed-config.js ja DEPLOY.md). Tyhjä arvo
// tarkoittaa samaa osoitetta - oikea asetus vain kun sivustoa ajetaan itse "npm start":lla.
const FEED_API_BASE = String(window.FASTFISH_API_BASE || '').trim().replace(/\/+$/, '');
function feedApiUrl(path){ return FEED_API_BASE + path; }
// Kuvapolut tulevat palvelimelta muodossa /uploads/xxx.jpg - eri osoitteessa ajettaessa niiden
// eteen tarvitaan palvelimen osoite, muutta kuvat haettaisiin sivuston omasta osoitteesta.
function feedAssetUrl(url){
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : FEED_API_BASE + url;
}

// Istunto kulkee vain api.fastfishin.com-palvelimen HttpOnly-evästeessä. Vanha
// localStorage-bearer poistetaan heti, jotta sivun JavaScript ei säilytä käyttökelpoista
// 30 päivän kirjautumistunnusta.
function clearLegacyFeedToken(){
  try { localStorage.removeItem('ff_session_token'); } catch(e) {}
}
clearLegacyFeedToken();
function getFeedToken(){ return ''; }
function setFeedToken(){ clearLegacyFeedToken(); }

function feedOfflineError(){
  const err = new Error(FEED_API_BASE
    ? 'Saalisfeedin palvelimeen ei juuri nyt saada yhteyttä. Yritä hetken kuluttua uudelleen.'
    : 'Saalisfeedin palvelinta ei ole vielä otettu käyttöön.');
  err.offline = true;
  feedApiOffline = true;
  return err;
}

async function feedApi(path, options){
  const opts = Object.assign({}, options);
  opts.credentials = 'include'; // api.fastfishin.com käyttää HttpOnly SameSite=Lax -istuntoevästettä

  let res;
  try {
    res = await fetch(feedApiUrl(path), opts);
  } catch(e) {
    // Verkkovirhe tai CORS-esto - palvelinta ei tavoiteta lainkaan.
    throw feedOfflineError();
  }

  // Staattinen tarjoilu (GitHub Pages) vastaa API-polkuunkin HTML-sivulla. Ilman tätä tarkistusta
  // JSON-jäsennys epäonnistuisi ja käyttäjä näkisi vain "Jokin meni pieleen".
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw feedOfflineError();
  }

  feedApiOffline = false;
  let data = null;
  try { data = await res.json(); } catch(e) { /* ei JSON-vartaloa */ }
  if (!res.ok) {
    if (res.status === 401) setFeedToken(''); // vanhentunut istunto - älä yritä sillä uudelleen
    const err = new Error((data && data.error) || 'Jokin meni pieleen.');
    err.status = res.status;
    throw err;
  }
  return data;
}

async function fetchFeedUser(){
  try {
    const data = await feedApi('/api/auth/me');
    feedUser = data.user;
    if (!feedUser) setFeedToken('');
  } catch(e) {
    feedUser = null;
  }
}

function renderFeedAuth(){
  const card = document.getElementById('feedAuthCard');
  if (!card) return;

  // Palvelinta ei tavoiteta: kerrotaan se suoraan sen sijaan, että näytettäisiin kirjautumis-
  // lomake, joka ei voi toimia. Aiemmin lomake näytti toimivalta ja kaatui vasta lähetykseen.
  if (feedApiOffline) {
    card.innerHTML = `
      <h3 style="margin-top:0;">Saalisfeedi ei ole juuri nyt käytettävissä</h3>
      <p>${FEED_API_BASE
        ? 'Saaliskuvien palvelimeen ei saada yhteyttä. Kyseessä on todennäköisesti tilapäinen katko - kokeile hetken kuluttua uudelleen.'
        : 'Saaliiden jakaminen vaatii palvelimen, jota ei ole vielä otettu käyttöön. Kirjautuminen ja kuvien julkaisu avautuvat heti kun se on tehty.'}</p>
      <div class="feed-form-actions">
        <button class="btn" type="button" id="feedRetryBtn">Yritä uudelleen</button>
      </div>
    `;
    const retryBtn = document.getElementById('feedRetryBtn');
    if (retryBtn) retryBtn.addEventListener('click', () => {
      feedApiOffline = false;
      card.innerHTML = '<p>Yhdistetään...</p>';
      initFeedPage();
    });
    return;
  }

  if (feedUser) {
    card.innerHTML = `
      <div class="feed-user-bar">
        <div class="feed-composer-identity">
          <span class="feed-composer-avatar" aria-hidden="true">${escapeHtml(String(feedUser.username || '?').charAt(0).toUpperCase())}</span>
          <span>Kirjautuneena: <strong>${escapeHtml(feedUser.username)}</strong></span>
        </div>
        <button class="btn" type="button" id="feedLogoutBtn">Kirjaudu ulos</button>
      </div>
      <div class="feed-composer-prompt">
        <div class="feed-composer-copy">
          <strong>Jaa uusi saalis</strong>
          <span>Lisää kuva ja halutessasi saalistiedot.</span>
        </div>
        <button class="btn primary feed-composer-toggle" type="button" id="feedComposerToggle" aria-expanded="false">＋ Lisää julkaisu</button>
      </div>
      <div class="feed-composer-form" id="feedComposerForm" hidden>
      <div class="feed-field">
        <label for="feedPostCaption">Uusi saalis</label>
        <textarea id="feedPostCaption" maxlength="280"></textarea>
      </div>
      <div class="feed-field">
        <label for="feedPostImage">Kuva (JPEG/PNG/WebP, enintään 8 Mt)</label>
        <input type="file" id="feedPostImage" accept="image/*">
        <img id="feedPostPreview" class="feed-post-preview" alt="Saaliskuvan esikatselu">
      </div>
      <details class="feed-catch-details" open>
        <summary>
          <span>Saalistiedot</span>
          <span class="feed-catch-optional">Vapaaehtoiset</span>
        </summary>
        <div class="feed-catch-grid">
          <div class="feed-field feed-catch-wide">
            <label for="feedPostSpecies">Kalalaji</label>
            <select id="feedPostSpecies">
              <option value="">Ei valintaa</option>
              <optgroup label="Petokalat">
                <option>Ahven</option><option>Hauki</option><option>Kuha</option><option>Toutain</option>
              </optgroup>
              <optgroup label="Lohikalat">
                <option>Lohi</option><option>Taimen</option><option>Kirjolohi</option><option>Siika</option>
                <option>Muikku</option><option>Harjus</option>
              </optgroup>
              <optgroup label="Muut yleiset saaliskalat">
                <option>Made</option><option>Särki</option><option>Lahna</option><option>Säyne</option>
                <option>Sorva</option><option>Suutari</option><option>Karppi</option><option>Kiiski</option>
                <option>Salakka</option><option>Muu kala</option>
              </optgroup>
            </select>
          </div>
          <div class="feed-field">
            <label for="feedPostWeight">Paino (kg)</label>
            <input type="number" id="feedPostWeight" inputmode="decimal" min="0.01" max="500" step="0.01">
          </div>
          <div class="feed-field">
            <label for="feedPostLength">Pituus (cm)</label>
            <input type="number" id="feedPostLength" inputmode="decimal" min="0.1" max="500" step="0.1">
          </div>
          <div class="feed-field feed-catch-wide">
            <label for="feedPostLocation">Saantipaikka</label>
            <input type="text" id="feedPostLocation" maxlength="100">
            <label class="feed-location-share"><input type="checkbox" id="feedPostShareLocation"> Näytä saantipaikka julkisesti postauksessa</label>
          </div>
          <div class="feed-field feed-catch-wide">
            <label for="feedPostLure">Viehe tai syötti</label>
            <input type="text" id="feedPostLure" maxlength="100">
          </div>
          <p class="feed-catch-privacy">Kaikki kentät ovat vapaaehtoisia. Jaa tarkka kalapaikka vain, jos haluat sen näkyvän kaikille.</p>
        </div>
      </details>
      <div class="feed-form-actions">
        <button class="btn primary" type="button" id="feedPostSubmitBtn">Julkaise</button>
      </div>
      <p class="feed-hint">Kuva ja teksti tarkistetaan automaattisesti ennen julkaisua - epäasiallinen sisältö hylätään.</p>
      <p class="feed-error" id="feedPostError" hidden></p>
      </div>
    `;
    const composerToggle = document.getElementById('feedComposerToggle');
    const composerForm = document.getElementById('feedComposerForm');
    composerToggle.addEventListener('click', () => {
      const willOpen = composerForm.hidden;
      composerForm.hidden = !willOpen;
      composerToggle.setAttribute('aria-expanded', String(willOpen));
      composerToggle.textContent = willOpen ? '− Sulje julkaisija' : '＋ Lisää julkaisu';
      if (willOpen) document.getElementById('feedPostCaption').focus();
    });
    document.getElementById('feedLogoutBtn').addEventListener('click', handleFeedLogout);
    document.getElementById('feedPostSubmitBtn').addEventListener('click', handleFeedNewPost);
    const fileInput = document.getElementById('feedPostImage');
    const preview = document.getElementById('feedPostPreview');
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) { preview.style.display = 'none'; return; }
      preview.src = URL.createObjectURL(file);
      preview.style.display = 'block';
    });
    return;
  }

  const isSignup = feedAuthMode === 'signup';
  card.innerHTML = `
    <div class="feed-guest-intro">
      <span class="feed-guest-icon" aria-hidden="true">↗</span>
      <div class="feed-guest-copy">
        <strong>Jaa oma saaliisi</strong>
        <span>Julkaise kuva, tykkää ja kommentoi muiden saaliita.</span>
      </div>
    </div>
    <button class="btn primary feed-auth-toggle" type="button" id="feedAuthToggle" aria-expanded="${feedAuthExpanded}">${feedAuthExpanded ? 'Sulje' : 'Kirjaudu tai luo tili'}</button>
    <div class="feed-auth-form" id="feedAuthForm" ${feedAuthExpanded ? '' : 'hidden'}>
      <h3>${isSignup ? 'Luo käyttäjä' : 'Kirjaudu sisään'}</h3>
      <div class="feed-field">
        <label for="feedUsername">Käyttäjänimi</label>
        <input type="text" id="feedUsername" autocomplete="username" maxlength="20">
      </div>
      <div class="feed-field">
        <label for="feedPassword">Salasana</label>
        <input type="password" id="feedPassword" autocomplete="${isSignup ? 'new-password' : 'current-password'}">
      </div>
      <div class="feed-form-actions">
        <button class="btn primary" type="button" id="feedAuthSubmitBtn">${isSignup ? 'Luo käyttäjä' : 'Kirjaudu'}</button>
        <button class="feed-switch-mode" type="button" id="feedSwitchModeBtn">${isSignup ? 'Onko sinulla jo tili? Kirjaudu' : 'Ei vielä tiliä? Luo käyttäjä'}</button>
      </div>
      ${isSignup ? '<p class="feed-hint">3-20 merkkiä (kirjaimet, numerot, - ja _), salasana vähintään 8 merkkiä. Käyttäjänimi tarkistetaan automaattisesti.</p>' : ''}
      <p class="feed-error" id="feedAuthError" hidden></p>
    </div>
  `;
  document.getElementById('feedAuthToggle').addEventListener('click', () => {
    feedAuthExpanded = !feedAuthExpanded;
    renderFeedAuth();
    if (feedAuthExpanded) document.getElementById('feedUsername').focus();
  });
  document.getElementById('feedAuthSubmitBtn').addEventListener('click', isSignup ? handleFeedSignup : handleFeedLogin);
  document.getElementById('feedSwitchModeBtn').addEventListener('click', () => {
    feedAuthMode = isSignup ? 'login' : 'signup';
    renderFeedAuth();
  });
}

function setFeedAuthBusy(busy){
  const btn = document.getElementById('feedAuthSubmitBtn');
  if (btn) btn.disabled = busy;
}
function showFeedAuthError(msg){
  const el = document.getElementById('feedAuthError');
  if (el) { el.textContent = msg; el.hidden = !msg; }
}

async function handleFeedSignup(){
  const username = document.getElementById('feedUsername').value.trim();
  const password = document.getElementById('feedPassword').value;
  showFeedAuthError('');
  setFeedAuthBusy(true);
  try {
    const data = await feedApi('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    setFeedToken(data.token);
    feedUser = { username: data.username };
    renderFeedAuth();
  } catch(e) {
    showFeedAuthError(e.message);
    if (e.offline) renderFeedAuth();
  } finally {
    setFeedAuthBusy(false);
  }
}

async function handleFeedLogin(){
  const username = document.getElementById('feedUsername').value.trim();
  const password = document.getElementById('feedPassword').value;
  showFeedAuthError('');
  setFeedAuthBusy(true);
  try {
    const data = await feedApi('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    setFeedToken(data.token);
    feedUser = { username: data.username };
    renderFeedAuth();
  } catch(e) {
    showFeedAuthError(e.message);
    if (e.offline) renderFeedAuth();
  } finally {
    setFeedAuthBusy(false);
  }
}

async function handleFeedLogout(){
  try { await feedApi('/api/auth/logout', { method: 'POST' }); } catch(e) { /* ei väliä, tyhjennetään silti paikallinen tila */ }
  setFeedToken('');
  feedUser = null;
  feedAuthMode = 'login';
  feedAuthExpanded = false;
  renderFeedAuth();
}

async function handleFeedNewPost(){
  async function prepareImageForUpload(file) {
  const type = (file.type || '').toLowerCase();

  if (['image/jpeg', 'image/png', 'image/webp'].includes(type)) {
    return file;
  }

  if (
    type === 'image/heic' ||
    type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')
  ) {
    const url = URL.createObjectURL(file);

    try {
      const img = new Image();

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () =>
          reject(new Error('iPhonen HEIC-kuvaa ei voitu käsitellä.'));
        img.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          result => result
            ? resolve(result)
            : reject(new Error('Kuvan muuntaminen epäonnistui.')),
          'image/jpeg',
          0.88
        );
      });

      return new File(
        [blob],
        file.name.replace(/\.(heic|heif)$/i, '.jpg'),
        { type: 'image/jpeg' }
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  throw new Error('Tätä kuvatyyppiä ei tueta.');
}
  const captionEl = document.getElementById('feedPostCaption');
  const fileInput = document.getElementById('feedPostImage');
  const speciesEl = document.getElementById('feedPostSpecies');
  const weightEl = document.getElementById('feedPostWeight');
  const lengthEl = document.getElementById('feedPostLength');
  const locationEl = document.getElementById('feedPostLocation');
  const shareLocationEl = document.getElementById('feedPostShareLocation');
  const lureEl = document.getElementById('feedPostLure');
  const errorEl = document.getElementById('feedPostError');
  const submitBtn = document.getElementById('feedPostSubmitBtn');
  const file = fileInput.files && fileInput.files[0];
  errorEl.hidden = true;

  if (!file) {
    errorEl.textContent = 'Valitse kuva ensin.';
    errorEl.hidden = false;
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    errorEl.textContent = 'Kuva on liian suuri (enintään 8 Mt).';
    errorEl.hidden = false;
    return;
  }

 const uploadFile = await prepareImageForUpload(file);
 const formData = new FormData();
 formData.append('image', uploadFile, uploadFile.name);
 formData.append('caption', captionEl.value.trim());
 if (speciesEl.value) formData.append('species', speciesEl.value);
 if (weightEl.value) formData.append('weightKg', weightEl.value);
 if (lengthEl.value) formData.append('lengthCm', lengthEl.value);
 if (locationEl.value.trim() && shareLocationEl.checked) {
   formData.append('catchLocation', locationEl.value.trim());
   formData.append('shareLocation', '1');
 }
 if (lureEl.value.trim()) formData.append('lure', lureEl.value.trim());

  submitBtn.disabled = true;
  submitBtn.textContent = 'Tarkistetaan ja julkaistaan...';
  try {
    await feedApi('/api/posts', { method: 'POST', body: formData });
    captionEl.value = '';
    fileInput.value = '';
    speciesEl.value = '';
    weightEl.value = '';
    lengthEl.value = '';
    locationEl.value = '';
    shareLocationEl.checked = false;
    lureEl.value = '';
    document.getElementById('feedPostPreview').style.display = 'none';
    const composerForm = document.getElementById('feedComposerForm');
    const composerToggle = document.getElementById('feedComposerToggle');
    if (composerForm) composerForm.hidden = true;
    if (composerToggle) {
      composerToggle.setAttribute('aria-expanded', 'false');
      composerToggle.textContent = '＋ Lisää julkaisu';
    }
    await loadFeed(true);
  } catch(e) {
    errorEl.textContent = e.message;
    errorEl.hidden = false;
    if (e.status === 401) { feedUser = null; renderFeedAuth(); }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Julkaise';
  }
}

function formatFeedTime(value) {
  try {
    if (!value) return '';

    const str = String(value);
    const d = new Date(
      str.includes('T') ? str : str.replace(' ', 'T') + 'Z'
    );

    if (Number.isNaN(d.getTime())) return '';

    return d.toLocaleString('fi-FI', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return '';
  }
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function feedHeartIcon(){
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"></path></svg>';
}
function feedCommentIcon(){
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-3.8 7.1 8.5 8.5 0 0 1-9 .4L3 21l1.9-5.2a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>';
}
function feedTrashIcon(){
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
}

// Jos käyttäjä ei ole kirjautunut, viedään näkyviin kirjautumislomakkeeseen sen sijaan että
// yritettäisiin API-kutsua joka joka tapauksessa hylättäisiin 401:llä.
function feedPromptLogin(){
  const card = document.getElementById('feedAuthCard');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function toggleLike(postId, btn){
  if (!feedUser) { feedPromptLogin(); return; }
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    const data = await feedApi('/api/posts/' + postId + '/like', { method: 'POST' });
    btn.classList.toggle('liked', data.liked);
    const countEl = btn.querySelector('.feed-like-count');
    if (countEl) countEl.textContent = data.likeCount;
    const post = feedPosts.find(item => item.id === postId);
    if (post) {
      post.likedByMe = data.liked;
      post.likeCount = data.likeCount;
    }
  } catch(e) {
    // Hiljainen epäonnistuminen (esim. verkkokatkos) - painike jää ennalleen, voi yrittää uudelleen.
  } finally {
    btn.disabled = false;
  }
}

async function deleteComment(postId, commentId, item, countEl){
  if (!confirm('Poistetaanko tämä kommentti?')) return;
  try {
    try {
      await feedApi('/api/posts/' + postId + '/comments/' + commentId + '/delete', {
        method: 'POST'
      });
    } catch (e) {
      // Jos tuotannossa oleva API-versio ei tunne POST-poistoreittiä, kokeile samaa
      // taaksepäin yhteensopivaa DELETE-reittiä automaattisesti.
      if (e.status !== 404) throw e;
      await feedApi('/api/posts/' + postId + '/comments/' + commentId, {
        method: 'DELETE'
      });
    }
    item.remove();
    if (countEl) countEl.textContent = String(Math.max(0, (parseInt(countEl.textContent, 10) || 1) - 1));
    updateFeedPostCommentCount(postId, -1);
  } catch(e) {
    alert(e.message || 'Poisto epäonnistui.');
  }
}

function renderFeedComment(c, postId, countEl){
  const item = document.createElement('div');
  item.className = 'feed-comment-item';
  const head = document.createElement('span');
  head.innerHTML = '<span class="feed-comment-user"></span><span class="feed-comment-time"></span>';
  head.querySelector('.feed-comment-user').textContent = c.username;
  head.querySelector('.feed-comment-time').textContent = formatFeedTime(c.createdAt);
  item.appendChild(head);
  const body = document.createElement('p');
  body.textContent = c.body;
  item.appendChild(body);
  if (c.canDelete) {
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'feed-comment-delete-btn';
    delBtn.setAttribute('aria-label', 'Poista kommentti');
    delBtn.innerHTML = feedTrashIcon();
    delBtn.addEventListener('click', () => deleteComment(postId, c.id, item, countEl));
    item.appendChild(delBtn);
  }
  return item;
}

async function loadComments(postId, wrap, countEl){
  const listEl = wrap.querySelector('.feed-comment-list');
  listEl.textContent = 'Ladataan kommentteja...';
  try {
    const data = await feedApi('/api/posts/' + postId + '/comments');
    listEl.innerHTML = '';
    if (!data.comments.length) {
      const p = document.createElement('p');
      p.className = 'feed-comment-status';
      p.textContent = 'Ei vielä kommentteja.';
      listEl.appendChild(p);
    } else {
      data.comments.forEach(c => listEl.appendChild(renderFeedComment(c, postId, countEl)));
    }
  } catch(e) {
    listEl.textContent = 'Kommenttien lataus epäonnistui.';
  }
}

function toggleCommentsPanel(postId, wrap, countEl){
  const wasHidden = wrap.hidden;
  wrap.hidden = !wasHidden;
  if (wasHidden && !wrap.dataset.loaded) {
    wrap.dataset.loaded = '1';
    loadComments(postId, wrap, countEl);
  }
}

async function submitComment(postId, wrap, countEl){
  if (!feedUser) { feedPromptLogin(); return; }
  const input = wrap.querySelector('.feed-comment-input');
  const statusEl = wrap.querySelector('.feed-comment-status');
  const body = input.value.trim();
  if (!body) return;
  input.disabled = true;
  try {
    const comment = await feedApi('/api/posts/' + postId + '/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body })
    });
    const listEl = wrap.querySelector('.feed-comment-list');
    const emptyMsg = listEl.querySelector('.feed-comment-status');
    if (emptyMsg) emptyMsg.remove();
    listEl.appendChild(renderFeedComment(comment, postId, countEl));
    input.value = '';
    if (statusEl) statusEl.textContent = '';
    if (countEl) countEl.textContent = String((parseInt(countEl.textContent, 10) || 0) + 1);
    updateFeedPostCommentCount(postId, 1);
  } catch(e) {
    if (statusEl) statusEl.textContent = e.message || 'Kommentin lähetys epäonnistui.';
  } finally {
    input.disabled = false;
  }
}

async function deletePost(postId, card){
  if (!confirm('Poistetaanko tämä saaliskuva pysyvästi?')) return;
  try {
    try {
      await feedApi('/api/posts/' + postId + '/delete', {
        method: 'POST'
      });
    } catch (e) {
      // Tuotannossa voi olla hetken käytössä palvelinversio, jossa on vain vanha
      // DELETE /api/posts/:id -reitti. Jos POST-reittiä ei löydy, käytetään sitä
      // automaattisesti, jotta kuvan poisto ei hajoa frontendin päivittyessä ensin.
      if (e.status !== 404) throw e;
      await feedApi('/api/posts/' + postId, {
        method: 'DELETE'
      });
    }
    feedPosts = feedPosts.filter(post => post.id !== postId);
    renderFeedPosts();
  } catch(e) {
    alert(e.message || 'Poisto epäonnistui.');
  }
}

function feedImageRetryUrl(url){
  const retryUrl = new URL(url, window.location.href);
  retryUrl.searchParams.set('ff_retry', String(Date.now()));
  return retryUrl.href;
}

function openFeedImage(url, alt, trigger){
  const modal = document.createElement('div');
  modal.className = 'feed-image-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Saaliskuva suurena');

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'feed-image-modal-close';
  closeBtn.setAttribute('aria-label', 'Sulje suuri kuva');
  closeBtn.textContent = '×';

  const largeImg = document.createElement('img');
  largeImg.src = url;
  largeImg.alt = alt;

  const previousOverflow = document.body.style.overflow;
  const close = () => {
    document.removeEventListener('keydown', onKeyDown);
    document.body.style.overflow = previousOverflow;
    modal.remove();
    if (trigger) trigger.focus();
  };
  const onKeyDown = (event) => {
    if (event.key === 'Escape') close();
  };

  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });
  document.addEventListener('keydown', onKeyDown);
  modal.append(closeBtn, largeImg);
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  closeBtn.focus();
}

function renderPostCard(post, index = 0){
  const card = document.createElement('article');
  card.className = 'feed-post-card';

  const header = document.createElement('header');
  header.className = 'feed-post-header';

  const avatar = document.createElement('span');
  avatar.className = 'feed-post-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = String(post.username || '?').trim().charAt(0).toUpperCase() || '?';

  const meta = document.createElement('div');
  meta.className = 'feed-post-meta';

  const userSpan = document.createElement('span');
  userSpan.className = 'feed-post-user';
  userSpan.textContent = post.username;

  const timeSpan = document.createElement('time');
  timeSpan.className = 'feed-post-time';
  timeSpan.textContent = formatFeedTime(post.createdAt);

  meta.append(userSpan, timeSpan);
  header.append(avatar, meta);
  card.appendChild(header);

  const imageUrl = feedAssetUrl(post.imageUrl);
  const imageButton = document.createElement('button');
  imageButton.type = 'button';
  imageButton.className = 'feed-image-button';
  imageButton.setAttribute('aria-label', 'Avaa saaliskuva suurena');
  imageButton.title = 'Avaa kuva';

  const img = document.createElement('img');
  img.className = 'feed-post-image';
  img.loading = index < 6 ? 'eager' : 'lazy';
  img.decoding = 'async';
  img.alt = 'Saaliskuva käyttäjältä ' + post.username;

  const imageStatus = document.createElement('span');
  imageStatus.className = 'feed-image-status';
  imageStatus.hidden = true;

  let retryCount = 0;
  let imageFailed = false;
  const loadImage = () => {
    imageFailed = false;
    imageButton.classList.remove('is-error');
    imageStatus.hidden = true;
    img.src = retryCount ? feedImageRetryUrl(imageUrl) : imageUrl;
  };
  img.addEventListener('load', () => {
    // Käytä kortissa kuvan omaa kuvasuhdetta. Kuvan ja kehyksen yhteinen korkeusraja
    // varmistaa, että myös pystykuva näkyy kokonaan eikä vuoda rajatun kehyksen ulkopuolelle.
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      imageButton.style.setProperty('--feed-image-ratio', img.naturalWidth + ' / ' + img.naturalHeight);
    }
    imageFailed = false;
    imageButton.classList.remove('is-error');
    imageStatus.hidden = true;
  });
  img.addEventListener('error', () => {
    if (retryCount < 1) {
      retryCount += 1;
      setTimeout(loadImage, 500);
      return;
    }
    imageFailed = true;
    imageButton.classList.add('is-error');
    imageStatus.textContent = 'Kuvan lataus epäonnistui. Paina ja yritä uudelleen.';
    imageStatus.hidden = false;
  });
  imageButton.addEventListener('click', () => {
    if (imageFailed) {
      retryCount = 0;
      loadImage();
      return;
    }
    openFeedImage(img.currentSrc || img.src, img.alt, imageButton);
  });

  imageButton.append(img, imageStatus);
  card.appendChild(imageButton);
  loadImage();

  const body = document.createElement('div');
  body.className = 'feed-post-body';

  if (post.caption) {
    const p = document.createElement('p');
    p.className = 'feed-post-caption';
    p.textContent = post.caption;
    body.appendChild(p);
  }

  const catchDetails = [
    post.species ? { label: 'Kalalaji', value: post.species } : null,
    Number(post.weightKg) > 0 ? {
      label: 'Paino',
      value: Number(post.weightKg).toLocaleString('fi-FI', { maximumFractionDigits: 2 }) + ' kg'
    } : null,
    Number(post.lengthCm) > 0 ? {
      label: 'Pituus',
      value: Number(post.lengthCm).toLocaleString('fi-FI', { maximumFractionDigits: 1 }) + ' cm'
    } : null,
    post.catchLocation ? { label: 'Saantipaikka', value: post.catchLocation, wide: true } : null,
    post.lure ? { label: 'Viehe / syötti', value: post.lure, wide: true } : null
  ].filter(Boolean);

  if (catchDetails.length) {
    const catchMeta = document.createElement('div');
    catchMeta.className = 'feed-catch-meta';
    catchDetails.forEach(detail => {
      const item = document.createElement('div');
      item.className = 'feed-catch-stat' + (detail.wide ? ' feed-catch-stat-wide' : '');

      const label = document.createElement('span');
      label.className = 'feed-catch-stat-label';
      label.textContent = detail.label;

      const value = document.createElement('span');
      value.className = 'feed-catch-stat-value';
      value.textContent = detail.value;

      item.append(label, value);
      catchMeta.appendChild(item);
    });
    body.appendChild(catchMeta);
  }

  const actions = document.createElement('div');
  actions.className = 'feed-post-actions';

  const likeBtn = document.createElement('button');
  likeBtn.type = 'button';
  likeBtn.className = 'feed-action-btn feed-like-btn' + (post.likedByMe ? ' liked' : '');
  likeBtn.setAttribute('aria-label', 'Tykkää');
  likeBtn.innerHTML = feedHeartIcon() + '<span class="feed-like-count">' + (post.likeCount || 0) + '</span>';
  body.appendChild(actions);
  actions.appendChild(likeBtn);

  const commentsWrap = document.createElement('div');
  commentsWrap.className = 'feed-comments';
  commentsWrap.hidden = true;
  commentsWrap.innerHTML = '<div class="feed-comment-list"></div>' +
    '<div class="feed-comment-form"><input type="text" class="feed-comment-input" maxlength="300" aria-label="Kirjoita kommentti"><button type="button" class="btn feed-comment-submit">Lähetä</button></div>' +
    '<p class="feed-comment-status"></p>';

  const commentBtn = document.createElement('button');
  commentBtn.type = 'button';
  commentBtn.className = 'feed-action-btn feed-comment-btn';
  commentBtn.setAttribute('aria-label', 'Kommentit');
  commentBtn.innerHTML = feedCommentIcon() + '<span class="feed-comment-count">' + (post.commentCount || 0) + '</span>';
  actions.appendChild(commentBtn);
  const commentCountEl = commentBtn.querySelector('.feed-comment-count');

  likeBtn.addEventListener('click', () => toggleLike(post.id, likeBtn));
  commentBtn.addEventListener('click', () => toggleCommentsPanel(post.id, commentsWrap, commentCountEl));
  commentsWrap.querySelector('.feed-comment-submit').addEventListener('click', () => submitComment(post.id, commentsWrap, commentCountEl));
  commentsWrap.querySelector('.feed-comment-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submitComment(post.id, commentsWrap, commentCountEl); }
  });

  if (post.canDelete) {
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'feed-action-btn feed-delete-btn';
    delBtn.setAttribute('aria-label', 'Poista');
    delBtn.innerHTML = feedTrashIcon() + '<span>Poista</span>';
    delBtn.addEventListener('click', () => deletePost(post.id, card));
    actions.appendChild(delBtn);
  }

  body.appendChild(commentsWrap);
  card.appendChild(body);
  return card;
}

function updateFeedPostCommentCount(postId, delta){
  const post = feedPosts.find(item => item.id === postId);
  if (post) post.commentCount = Math.max(0, Number(post.commentCount || 0) + delta);
}

function feedSearchText(post){
  return [post.username, post.caption, post.species, post.catchLocation, post.lure]
    .filter(Boolean).join(' ').toLocaleLowerCase('fi-FI');
}

function renderFeedPosts(){
  const listEl = document.getElementById('feedList');
  const statusEl = document.getElementById('feedListStatus');
  const countEl = document.getElementById('feedVisibleCount');
  const searchEl = document.getElementById('feedSearchInput');
  const speciesEl = document.getElementById('feedSpeciesFilter');
  if (!listEl) return;

  const query = String(searchEl && searchEl.value || '').trim().toLocaleLowerCase('fi-FI');
  const species = String(speciesEl && speciesEl.value || '');
  const visible = feedPosts.filter(post => {
    if (species && post.species !== species) return false;
    return !query || feedSearchText(post).includes(query);
  });

  listEl.innerHTML = '';
  visible.forEach((post, index) => listEl.appendChild(renderPostCard(post, index)));
  if (countEl) countEl.textContent = feedPosts.length
    ? visible.length + ' / ' + feedPosts.length + ' ladatusta julkaisusta'
    : '';

  if (statusEl && !feedLoading) {
    statusEl.textContent = feedPosts.length === 0
      ? 'Ei vielä saaliskuvia – ole ensimmäinen!'
      : (visible.length === 0 ? 'Näillä hakuehdoilla ei löytynyt saaliita.' : '');
  }
}

function showFeedSkeleton(){
  const listEl = document.getElementById('feedList');
  if (!listEl) return;
  listEl.innerHTML = '';
  for (let i = 0; i < 2; i += 1) {
    const skeleton = document.createElement('article');
    skeleton.className = 'feed-skeleton';
    skeleton.setAttribute('aria-hidden', 'true');
    skeleton.innerHTML =
      '<div class="feed-skeleton-head"><span class="feed-skeleton-avatar"></span>' +
      '<span class="feed-skeleton-lines"><i class="feed-skeleton-line"></i><i class="feed-skeleton-line"></i></span></div>' +
      '<div class="feed-skeleton-image"></div><div class="feed-skeleton-body"></div>';
    listEl.appendChild(skeleton);
  }
}

async function loadFeed(reset){
  if (feedLoading) return;
  feedLoading = true;
  const listEl = document.getElementById('feedList');
  const statusEl = document.getElementById('feedListStatus');
  const moreBtn = document.getElementById('feedLoadMoreBtn');

  if (reset) {
    feedCursor = null;
    feedHasMore = true;
    feedPosts = [];
    showFeedSkeleton();
  }
  if (statusEl) statusEl.textContent = '';
  if (moreBtn) {
    moreBtn.hidden = true;
    moreBtn.disabled = true;
  }

  try {
    const qs = feedCursor ? `?before=${feedCursor}&limit=20` : '?limit=20';
    const data = await feedApi('/api/posts' + qs);
    const posts = data.posts || [];
    const knownIds = new Set(feedPosts.map(post => post.id));
    posts.forEach(post => {
      if (knownIds.has(post.id)) return;
      knownIds.add(post.id);
      feedPosts.push(post);
    });
    feedHasMore = posts.length === 20;
    if (posts.length) feedCursor = posts[posts.length - 1].id;
    feedLoading = false;
    renderFeedPosts();
    if (moreBtn) moreBtn.hidden = !feedHasMore;
  } catch(e) {
    if (listEl && reset) listEl.innerHTML = '';
    if (statusEl) statusEl.textContent = e.offline ? '' : 'Saaliiden lataus epäonnistui.';
    if (e.offline) renderFeedAuth();
  } finally {
    feedLoading = false;
    if (moreBtn) moreBtn.disabled = false;
  }
}

document.getElementById('feedLoadMoreBtn')?.addEventListener('click', () => loadFeed(false));
document.getElementById('feedSearchInput')?.addEventListener('input', renderFeedPosts);
document.getElementById('feedSpeciesFilter')?.addEventListener('change', renderFeedPosts);

async function initFeedPage(){
  await fetchFeedUser();
  renderFeedAuth();
  await loadFeed(true); // asettaa feedApiOffline:n jos palvelinta ei tavoiteta
}

function degToCompass(deg){
  const dirs = currentLang === 'fi'
    ? ["P","KO","I","KA","E","LO","L","LU"]
    : ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg/45)%8];
}
function moonPhase(date){
  const synodic=29.53058867, known=Date.UTC(2000,0,6,18,14,0);
  let phase=((date.getTime()-known)/86400000%synodic)/synodic;
  if(phase<0) phase+=1;
  return phase;
}
function moonPhaseInfo(date){
  const phase=moonPhase(date);
  const daysToNew=Math.min(phase,1-phase)*29.53;
  const daysToFull=Math.abs(phase-.5)*29.53;
  const minDays=Math.min(daysToNew,daysToFull);
  let name = currentLang === 'fi' ? "Vähenevä sirppi" : "Waning crescent", icon="☾";
  if(phase<.03||phase>.97){name=currentLang === 'fi' ? "Uusikuu" : "New moon";icon="●"}
  else if(phase<.22){name=currentLang === 'fi' ? "Kasvava sirppi" : "Waxing crescent";icon="☽"}
  else if(phase<.28){name=currentLang === 'fi' ? "Puolikuu kasvava" : "First quarter";icon="◐"}
  else if(phase<.47){name=currentLang === 'fi' ? "Kasvava kupera" : "Waxing gibbous";icon="◐"}
  else if(phase<.53){name=currentLang === 'fi' ? "Täysikuu" : "Full moon";icon="○"}
  else if(phase<.72){name=currentLang === 'fi' ? "Vähenevä kupera" : "Waning gibbous";icon="◑"}
  else if(phase<.78){name=currentLang === 'fi' ? "Puolikuu vähenevä" : "Third quarter";icon="◑"}
  return {phase,minDays,name,icon};
}
function calibrateCoreScore(rawScore){
  const raw=Math.max(0,Math.min(100,Number(rawScore)||0));
  const calibrated=raw<=50?50-(50-raw)*.90:50+(raw-50)*.82;
  return Math.max(0,Math.min(94,Math.round(calibrated)));
}
function scoreLabel(score){
  const english=currentLang!=='fi';
  if(score>=86) return {text:english?'Exceptional':'Poikkeuksellisen hyvä', color:'#426f33'};
  if(score>=72) return {text:english?'Very good':'Erittäin hyvä', color:'#4f7d42'};
  if(score>=56) return {text:english?'Good':'Hyvä', color:'#2e656b'};
  if(score>=40) return {text:english?'Fair':'Kohtalainen', color:'#d97725'};
  return {text:english?'Poor':'Heikko', color:'#a94635'};
}
function setGauge(score){
  score=Math.max(0,Math.min(100,Math.round(score)));
  const start=-135,end=135,total=end-start,R=120,cx=150,cy=150;
  const polar=a=>{const r=(a-90)*Math.PI/180;return [cx+R*Math.cos(r),cy+R*Math.sin(r)]};
  const arcPath=(a0,a1)=>{const [x0,y0]=polar(a0),[x1,y1]=polar(a1);return `M ${x0} ${y0} A ${R} ${R} 0 ${(a1-a0)>180?1:0} 1 ${x1} ${y1}`};
  const angle=start+(score/100)*total;
  document.getElementById("track").setAttribute("d",arcPath(start,end));
  document.getElementById("arc").setAttribute("d",arcPath(start,angle));
  document.getElementById("needle").setAttribute("transform",`rotate(${angle} 150 150)`);
  const lbl=scoreLabel(score);
  document.getElementById("scoreNum").textContent=score;
  document.getElementById("scoreNum").style.color=lbl.color;
  document.getElementById("scoreLabel").textContent=lbl.text;
  document.getElementById("scoreLabel").style.color=lbl.color;
  document.getElementById("arc").setAttribute("stroke",lbl.color);
}
function pressureTrendText(delta){
  if (currentLang === 'fi') {
    if(delta<=-1) return {text:`Laskee ${Math.abs(delta).toFixed(1)} hPa / 6 h`, cls:"trend-down"};
    if(delta>=1) return {text:`Nousee ${delta.toFixed(1)} hPa / 6 h`, cls:"trend-up"};
    return {text:"Vakaa", cls:"trend-flat"};
  } else {
    if(delta<=-1) return {text:`Falling ${Math.abs(delta).toFixed(1)} hPa / 6 h`, cls:"trend-down"};
    if(delta>=1) return {text:`Rising ${delta.toFixed(1)} hPa / 6 h`, cls:"trend-up"};
    return {text:"Stable", cls:"trend-flat"};
  }
}
async function fetchWeather(loc){
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&hourly=temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,cloud_cover&daily=sunrise,sunset&past_days=1&forecast_days=8&timezone=auto&wind_speed_unit=ms`;
  const controller=new AbortController();
  const timeoutId=setTimeout(()=>controller.abort(),6500);
  try{
    const res=await fetch(url,{signal:controller.signal});
    clearTimeout(timeoutId);
    if(!res.ok) throw new Error("Sään haku epäonnistui");
    return await res.json();
  }catch(err){clearTimeout(timeoutId);throw err}
}
function nearestHourIndex(times){
  const now=new Date();
  let best=0,bestDiff=Infinity;
  times.forEach((t,i)=>{const d=Math.abs(new Date(t)-now);if(d<bestDiff){bestDiff=d;best=i}});
  return best;
}
const SPECIES_MODIFIERS = {
  hauki:c=>((c.cloud>=40?8:0)+(c.cloud<20&&!c.isPrimeTime?-6:0)+(c.temp>22?-10:0)+(c.temp<=16?4:0)+(c.wind>9?-5:0)),
  kuha:c=>((c.cloud>=50?14:0)+(c.cloud<30&&!c.isPrimeTime?-10:0)+(c.isPrimeTime?8:0)+(c.temp<4?-5:0)),
  ahven:c=>((c.wind>=1&&c.wind<=5?6:0)+(c.cloud>=30?5:0)+(c.temp>=8&&c.temp<=20?4:0)),
  taimen:c=>((c.temp>=4&&c.temp<=14?10:0)+(c.temp>18?-12:0)+(c.wind>=2&&c.wind<=8?6:0)+(c.isSeaSummer?-45:0)),
  sarki:c=>((c.temp>=14?8:0)+(c.cloud<30?3:0)+(c.temp<5?-8:0)),
  // Karppi syö parhaiten lämpimässä vedessä ja ilmanpaineen laskiessa (esim. ukkosen alla); kylmässä vedessä lähes passiivinen
  karppi:c=>((c.temp>=16?10:0)+(c.temp<8?-14:0)+(c.cloud>=50?4:0)),
  // Monni on yöeläin - hämärä/pilvisyys ja lämmin kesäkeli suosivat, kylmä vesi latistaa aktiivisuuden lähes nollaan
  monni:c=>((c.isPrimeTime?12:0)+(c.temp>=16?8:0)+(c.temp<10?-16:0)+(c.cloud>=40?4:0)),
  // Mustebassi on kylmäverisenä hyvin lämpötilaherkkä - viileä vesi laskee aktiivisuutta merkittävästi
  mustebassi:c=>((c.temp>=18&&c.temp<=27?10:0)+(c.temp<12?-15:0)+(c.wind>=1&&c.wind<=6?4:0)+(c.cloud>=30?3:0)),
  // Toutain/barbo syö aktiivisesti lämpimässä virtaavassa vedessä, erityisesti sateen nostaman virtaaman jälkeen
  barbo:c=>((c.temp>=14?8:0)+(c.temp<8?-10:0)+(c.cloud>=40?3:0))
};
function isBalticCoast(name){
  return /meri|saaristo|ahvenanmaa|hanko|kaskinen|kristiinankaupunki|inkoo|kirkkonummi|loviisa|parainen|kemiönsaari|kaarina|tammisaari|pernajanlahti|kuusistonlahti|halikonlahti|porkkala|merenkurkku|suomenlahti|sipoonlahti/i.test(name||"");
}
// Nimipohjainen tunnistus toimii vain valmislistan paikoille. GPS:llä haetulle
// "Oma sijaintisi" -pisteelle (ja muille dynaamisille pisteille) nimi ei kerro
// mitään rannikosta, joten taimenen/lohen kesäalennus ("isSeaSummer") ei koskaan
// lauennut GPS-sijainnille, vaikka käyttäjä olisi seissyt aivan Itämeren rannalla -
// tästä syystä pisteet saattoivat näyttää epäluotettavan korkeilta (esim. 66) kesällä
// merellä. Korjataan lisäämällä koordinaattipohjainen varmistus tunnettuja
// rannikkopisteitä vasten.
const COASTAL_REFERENCE_POINTS = LOCATIONS.filter(l=>isBalticCoast(l.name));
function isNearBalticCoast(lat,lon){
  if(lat==null||lon==null||!isFinite(lat)||!isFinite(lon)) return false;
  return COASTAL_REFERENCE_POINTS.some(l=>haversineKm(lat,lon,l.lat,l.lon)<=12);
}
function isSeaLocation(loc){
  if(!loc) return false;
  if(isBalticCoast(loc.name)) return true;
  return isNearBalticCoast(loc.lat,loc.lon);
}
function isSummerMonth(date){ const m=date.getMonth(); return m>=5&&m<=7; }
function computeCoreScore({delta,wind,cloud,temp,isPrimeTime,species,isSeaSummer}){
  const moon=moonPhaseInfo(new Date());
  let pressureScore=delta<=-3?95:delta<=-1?78:delta<1?58:delta<3?35:12;
  let windScore=wind<1?38:wind<=4?92:wind<=7?68:wind<=10?35:10;
  let cloudScore=cloud<20?(isPrimeTime?65:32):cloud<70?62:82;
  let tempScore=(temp>=5&&temp<=20)?68:(temp<-5||temp>27)?25:48;
  let moonScore=moon.minDays<=1?78:moon.minDays<=3?60:45;
  let timeScore=isPrimeTime?88:45;
  let score=pressureScore*.26+windScore*.20+cloudScore*.20+moonScore*.12+timeScore*.17+tempScore*.05;
  const speciesBonus=Math.round((SPECIES_MODIFIERS[species]||(()=>0))({temp,cloud,wind,isPrimeTime,isSeaSummer})*.6);
  score=score+speciesBonus;
  if(species==="taimen"&&isSeaSummer) score=Math.min(score,32);
  return {score:calibrateCoreScore(score),speciesBonus,moon,isSeaSummer:!!isSeaSummer};
}
function computeScore(data,idx,species,loc){
  const h=data.hourly;
  const pressureNow=h.pressure_msl[idx], pressureBefore=h.pressure_msl[Math.max(0,idx-6)];
  const delta=pressureNow-pressureBefore, wind=h.wind_speed_10m[idx], cloud=h.cloud_cover[idx], temp=h.temperature_2m[idx];
  const now=new Date(), sunrise=new Date(data.daily.sunrise[1]||data.daily.sunrise[0]), sunset=new Date(data.daily.sunset[1]||data.daily.sunset[0]);
  const isPrimeTime=Math.abs(now-sunrise)/60000<=90||Math.abs(now-sunset)/60000<=90;
  const isSeaSummer=isSeaLocation(loc)&&isSummerMonth(now);
  const core=computeCoreScore({delta,wind,cloud,temp,isPrimeTime,species,isSeaSummer});
  return {score:core.score,delta,wind,cloud,temp,moon:core.moon,sunrise,sunset,isPrimeTime,pressureNow,speciesBonus:core.speciesBonus,isSeaSummer:core.isSeaSummer};
}
function scoreForHour(data,idx,species,loc){
  const h=data.hourly;
  const delta=h.pressure_msl[idx]-h.pressure_msl[Math.max(0,idx-6)];
  const wind=h.wind_speed_10m[idx], cloud=h.cloud_cover[idx], temp=h.temperature_2m[idx];
  const dateStr=h.time[idx].slice(0,10);
  let dayIdx=data.daily.time.indexOf(dateStr); if(dayIdx===-1) dayIdx=1;
  const sunrise=new Date(data.daily.sunrise[dayIdx]), sunset=new Date(data.daily.sunset[dayIdx]), hourDate=new Date(h.time[idx]);
  const isPrimeTime=Math.abs(hourDate-sunrise)/60000<=90||Math.abs(hourDate-sunset)/60000<=90;
  const isSeaSummer=isSeaLocation(loc)&&isSummerMonth(hourDate);
  const core=computeCoreScore({delta,wind,cloud,temp,isPrimeTime,species,isSeaSummer});
  return {time:hourDate,score:core.score,isPrimeTime};
}
function buildHourlyTimeline(data,startIdx,species,loc){
  const endIdx=Math.min(data.hourly.time.length-1,startIdx+24), timeline=[];
  for(let i=startIdx;i<=endIdx;i++) timeline.push(scoreForHour(data,i,species,loc));
  return timeline;
}
function fmtTime(d){
  return d.toLocaleTimeString(currentLang === 'fi' ? "fi-FI" : "en-US", {hour:"2-digit",minute:"2-digit"});
}
function dayShortLabel(date){
  const days = currentLang === 'fi' ? ["Su","Ma","Ti","Ke","To","Pe","La"] : ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return days[date.getDay()];
}
function dayEssiveLabel(date){
  const days = currentLang === 'fi'
    ? ["sunnuntaina","maanantaina","tiistaina","keskiviikkona","torstaina","perjantaina","lauantaina"]
    : ["on Sunday","on Monday","on Tuesday","on Wednesday","on Thursday","on Friday","on Saturday"];
  return days[date.getDay()];
}
function fmtDayDate(date){
  return date.toLocaleDateString(currentLang === 'fi' ? "fi-FI" : "en-US", {day:"numeric", month:"numeric"});
}
function buildDailySummaries(data,startIdx,species,loc,numDays=7){
  const h=data.hourly, groups={}, order=[];
  for(let i=startIdx;i<h.time.length;i++){
    const key=h.time[i].slice(0,10);
    if(!groups[key]){groups[key]=[];order.push(key)}
    groups[key].push(i);
  }
  return order.slice(0,numDays).map((key,pos)=>{
    const idxs=groups[key];
    let best=null;
    idxs.forEach(i=>{
      const r=scoreForHour(data,i,species,loc);
      if(!best||r.score>best.score) best=r;
    });
    return {dateKey:key,date:new Date(key+"T12:00:00"),isToday:pos===0,best,hours:idxs};
  });
}
function renderDailyForecast(summaries,selectedKey){
  const host=document.getElementById("dailyForecastHost");
  if(!host||!summaries||!summaries.length) return;
  const todayLabel = currentLang === 'fi' ? 'Tänään' : 'Today';
  const atLabel = currentLang === 'fi' ? 'klo' : 'at';
  host.innerHTML = summaries.map(day=>{
    const lbl=scoreLabel(day.best.score);
    const nameText = day.isToday ? todayLabel : dayShortLabel(day.date);
    const active = day.dateKey===selectedKey ? " active" : "";
    return `<button type="button" class="day-card${active}" data-day="${day.dateKey}" aria-pressed="${day.dateKey===selectedKey}">
      <div class="day-name">${nameText}</div>
      <div class="day-date">${fmtDayDate(day.date)}</div>
      <div class="day-score" style="background:${lbl.color}">${day.best.score}</div>
      <div class="day-label" style="color:${lbl.color}">${lbl.text}</div>
      <div class="day-best">${atLabel} ${fmtTime(day.best.time)}</div>
    </button>`;
  }).join("");
  host.querySelectorAll(".day-card").forEach(btn=>{
    btn.addEventListener("click",()=>selectForecastDay(btn.dataset.day));
  });
}
function selectForecastDay(dateKey){
  if(!lastWeatherData||!lastDailySummaries) return;
  const day=lastDailySummaries.find(d=>d.dateKey===dateKey);
  if(!day) return;
  selectedDayKey=dateKey;
  const timeline=day.hours.map(i=>scoreForHour(lastWeatherData,i,lastSpeciesForDaily,lastLocForDaily));
  const labelWord = day.isToday ? (currentLang==='fi'?'tänään':'today') : dayEssiveLabel(day.date);
  const contextLabel = currentLang==='fi' ? `Paras hetki ${labelWord}:` : `Best moment ${labelWord}:`;
  renderHourlyChart(timeline, contextLabel);
  renderDailyForecast(lastDailySummaries, dateKey);
}
function renderHourlyChart(timeline, contextLabel){
  const host=document.getElementById("hourlyHost");
  const maxScore=Math.max(...timeline.map(t=>t.score));
  const bestIdx=timeline.findIndex(t=>t.score===maxScore);
  const defaultLabel = currentLang === 'fi' ? 'Paras hetki seuraavan vuorokauden aikana:' : 'Best moment in the next 24 hours:';
  const bestLabel = contextLabel || defaultLabel;
  const pointsLabel = currentLang === 'fi' ? 'p.' : 'pts';

  document.getElementById("bestWindow").innerHTML=`${bestLabel} <strong>${fmtTime(timeline[bestIdx].time)}</strong> (${timeline[bestIdx].score} ${pointsLabel})`;
  host.innerHTML=`<div class="hbar-chart">${timeline.map((t,i)=>{
    const lbl=scoreLabel(t.score), show=t.time.getMinutes()===0&&t.time.getHours()%3===0;
    return `<div class="hbar-col" title="${fmtTime(t.time)} - ${t.score} ${pointsLabel}"><div class="hbar ${i===bestIdx?"hbar-best":""}" style="height:${Math.max(6,t.score)}%;background:${lbl.color}"></div><div class="hbar-time">${show?fmtTime(t.time):""}</div></div>`;
  }).join("")}</div>`;
}
function renderStrip(info){
  const trend=pressureTrendText(info.delta);
  const pressureLabel = currentLang === 'fi' ? 'Ilmanpaine' : 'Pressure';
  const windLabel = currentLang === 'fi' ? 'Tuuli' : 'Wind';
  const dirLabel = currentLang === 'fi' ? 'Suunta:' : 'Direction:';
  const cloudLabel = currentLang === 'fi' ? 'Pilvisyys' : 'Cloud Cover';
  const tempLabel = currentLang === 'fi' ? 'Lämpötila' : 'Temperature';
  const airTempLabel = currentLang === 'fi' ? 'Ilman lämpötila' : 'Air temperature';
  const moonLabel = currentLang === 'fi' ? 'Kuu' : 'Moon';
  const dayTimeLabel = currentLang === 'fi' ? 'Vuorokaudenaika' : 'Time of Day';
  const primeLabel = currentLang === 'fi' ? 'Prime time' : 'Prime time';
  const normalLabel = currentLang === 'fi' ? 'Peruskeli' : 'Normal time';
  const riseLabel = currentLang === 'fi' ? 'Nousu' : 'Rise';
  const setLabel = currentLang === 'fi' ? 'lasku' : 'set';

  let cloudText = "";
  if (info.cloud < 20) cloudText = currentLang === 'fi' ? "Kirkas" : "Clear";
  else if (info.cloud < 70) cloudText = currentLang === 'fi' ? "Puolipilvinen" : "Partly cloudy";
  else cloudText = currentLang === 'fi' ? "Pilvinen" : "Overcast";

  document.getElementById("stripHost").innerHTML=`<div class="strip">
    <div class="stat"><div class="label">${pressureLabel}</div><div class="value">${info.pressureNow?info.pressureNow.toFixed(0):"--"} hPa</div><div class="sub ${trend.cls}">${trend.text}</div></div>
    <div class="stat"><div class="label">${windLabel}</div><div class="value">${info.wind.toFixed(1)} m/s</div><div class="sub">${dirLabel} ${info.windCompass||"-"}</div></div>
    <div class="stat"><div class="label">${cloudLabel}</div><div class="value">${info.cloud.toFixed(0)}%</div><div class="sub">${cloudText}</div></div>
    <div class="stat"><div class="label">${tempLabel}</div><div class="value">${info.temp.toFixed(1)}°C</div><div class="sub">${airTempLabel}</div></div>
    <div class="stat"><div class="label">${moonLabel}</div><div class="value">${info.moon.icon}</div><div class="sub">${info.moon.name}</div></div>
    <div class="stat"><div class="label">${dayTimeLabel}</div><div class="value" style="font-size:20px">${info.isPrimeTime?primeLabel:normalLabel}</div><div class="sub">${riseLabel} ${fmtTime(info.sunrise)} · ${setLabel} ${fmtTime(info.sunset)}</div></div>
  </div>`;
}
function verdictSentence(info){
  const parts=[];
  if (currentLang === 'fi') {
    if(info.delta<=-1) parts.push("laskeva ilmanpaine voi piristää syöntiä");
    else if(info.delta>=1) parts.push("nouseva paine voi hiljentää aktiivisuutta");
    if(info.wind>=1&&info.wind<=7) parts.push("tuuli on kalastukseen sopiva");
    if(info.cloud>=20) parts.push("pilvisyys pehmentää valoa");
    if(info.moon.minDays<=3) parts.push(`kuu on lähellä ${info.moon.phase<.5?"uutta":"täyttä"} vaihetta`);
    if(info.isPrimeTime) parts.push("ajoitus osuu hämärän syönti-ikkunaan");
    let sentence=parts.length?`Tänään ${parts.join(", ")}.`:"Keli on tavallinen: ei selkeää piikkiä, mutta ei täyttä jarruakaan.";
    if(info.speciesBonus>=8) sentence+=" Olosuhteet suosivat valittua kalaa.";
    else if(info.isSeaSummer&&info.speciesBonus<-15) sentence+=" Itämeren vaeltava taimen ja lohi ovat kesällä harvassa rannikolla - parhaat saumat löytyvät joista ja koskilta, tai odota syksyn nousua.";
    else if(info.speciesBonus<=-6) sentence+=" Valitulle kalalle tämä ei ole päivän helpoin hetki.";
    return sentence;
  } else {
    if(info.delta<=-1) parts.push("falling air pressure can stimulate feeding");
    else if(info.delta>=1) parts.push("rising pressure can slow down activity");
    if(info.wind>=1&&info.wind<=7) parts.push("wind conditions are suitable for fishing");
    if(info.cloud>=20) parts.push("cloud cover softens the light");
    if(info.moon.minDays<=3) parts.push(`moon is near ${info.moon.phase<.5?"new":"full"} phase`);
    if(info.isPrimeTime) parts.push("timing hits the twilight feeding window");
    let sentence=parts.length?`Today ${parts.join(", ")}.`:"The weather is average: no clear peak, but no absolute brakes either.";
    if(info.speciesBonus>=8) sentence+=" Conditions favor the selected fish species.";
    else if(info.isSeaSummer&&info.speciesBonus<-15) sentence+=" Migrating Baltic trout and salmon are scarce along the coast in summer - your best chances are in rivers, or wait for the autumn run.";
    else if(info.speciesBonus<=-6) sentence+=" This is not the easiest moment of the day for the selected fish.";
    return sentence;
  }
}
function conditionKey(info){return info.temp<8?"cold":info.cloud>=40?"murky":"clear"}
function detectTimeOfDay(info){
  const now=new Date();
  if(info && info.sunrise instanceof Date && info.sunset instanceof Date && info.sunrise.getTime()!==info.sunset.getTime()){
    const dawnStart=new Date(info.sunrise.getTime()-90*60000), dawnEnd=new Date(info.sunrise.getTime()+90*60000);
    const duskStart=new Date(info.sunset.getTime()-90*60000), duskEnd=new Date(info.sunset.getTime()+90*60000);
    if(now>=dawnStart&&now<=dawnEnd) return "dawn";
    if(now>=duskStart&&now<=duskEnd) return "dusk";
    if(now>info.sunrise&&now<info.sunset) return "day";
    return "night";
  }
  const h=now.getHours();
  if(h>=4&&h<8) return "dawn";
  if(h>=8&&h<19) return "day";
  if(h>=19&&h<23) return "dusk";
  return "night";
}
function renderConditionsBar(species,info){
  const bar=document.getElementById("conditionsBar");
  if(!bar) return;
  const trans=UI_TRANS[currentLang];
  const set=LURES[species]||LURES.ahven;
  const key=conditionKey(info);
  const waterLabel=(set[key]&&set[key].tag)||"-";
  const timeKey=detectTimeOfDay(info);
  const timeLabel=TIME_TRANS[currentLang][timeKey].label;
  let moonHtml="";
  if(info&&info.moon){
    moonHtml=`<div class="condition-chip"><span class="cc-label">${trans.cc_moon}</span><span class="cc-value">${info.moon.icon} ${info.moon.name}</span></div>`;
  }
  bar.innerHTML=`<div class="condition-chip"><span class="cc-label">${trans.cc_water}</span><span class="cc-value">${waterLabel}</span></div><div class="condition-chip"><span class="cc-label">${trans.cc_time}</span><span class="cc-value">${timeLabel}</span></div>${moonHtml}`;
}
function renderLures(species,info){
  const grid=document.getElementById("lureGrid");
  const trans=UI_TRANS[currentLang];
  const condSet=LURES[species]||LURES.ahven;
  const key=conditionKey(info);
  const condEntry=condSet[key];
  const timeInfo=TIME_TRANS[currentLang][detectTimeOfDay(info)];
  grid.innerHTML=`<article class="tip-card tip-card-now">
    <span class="now-badge">${trans.lure_now_badge}</span>
    <div class="lure-combo-tags"><span class="tag">${condEntry.tag}</span><span class="tag">${timeInfo.label}</span></div>
    <h3>${condEntry.name}</h3>
    <p>${condEntry.desc}</p>
    <p class="lure-combo-time"><strong>${timeInfo.label}:</strong> ${timeInfo.tip}</p>
  </article>`;
  renderConditionsBar(species,info);
  renderRealLures(species);
  renderWaterVariants(species,key);
}
function renderRealLures(species){
  const host=document.getElementById("realLureGrid");
  if(!host) return;
  const items=(REAL_LURES_TRANS[currentLang]&&REAL_LURES_TRANS[currentLang][species])||REAL_LURES_TRANS[currentLang].ahven;
  host.innerHTML=items.map(it=>`<article class="tip-card lure-product-card">
    <span class="lure-product-type">${it.type}</span>
    <span class="lure-product-brand">${it.brand}</span>
    <h3 class="lure-product-model">${it.model}</h3>
    <p>${it.note}</p>
  </article>`).join("");
}
function renderWaterVariants(species,activeKey){
  const host=document.getElementById("waterVariantsGrid");
  if(!host) return;
  const condSet=LURES[species]||LURES.ahven;
  const order=["clear","murky","cold"];
  host.innerHTML=order.map(k=>{
    const entry=condSet[k];
    const isActive=k===activeKey;
    return `<article class="tip-card"${isActive?' style="border-color:var(--orange);box-shadow:0 0 0 1px var(--orange), var(--shadow-small);"':''}>
      <span class="tag"${isActive?' style="background:var(--orange);color:#fff;"':''}>${entry.tag}</span>
      <h3>${entry.name}</h3>
      <p>${entry.desc}</p>
    </article>`;
  }).join("");
}
function renderRules(){
  const rules = currentLang === 'fi' ? [
    ["Kirkas vesi","Luonnollinen väri, pienempi profiili ja pidemmät tauot. Kala näkee hyvin ja ehtii epäillä."],
    ["Samea vesi","Lisää kontrastia, ääntä tai välkettä. Firetiger, oranssi, chartreuse ja musta ovat hyviä testejä."],
    ["Kylmä vesi","Hidasta. Pienempi liike, pidempi tauko ja kalastus lähellä pohjaa tai suojapaikkaa."],
    ["Lämmin vesi","Etsi happea: tuulen puoli, virtaus, varjo, syvänteen reuna ja aamu/ilta."],
    ["Ei tärppiä?","Vaihda ensin syvyys ja nopeus. Väri on usein vasta kolmas säätö."],
    ["Peruke","Hauelle aina puruperuke. Kuhalle ja ahvenelle ohuempi fluorocarbon voi parantaa syöntiä kirkkaassa vedessä."]
  ] : [
    ["Clear Water","Natural color, smaller profile, and longer pauses. The fish can see well and will hesitate."],
    ["Murky Water","Add contrast, sound, or flash. Firetiger, orange, chartreuse, and black are great test options."],
    ["Cold Water","Slow down. Smaller movement, longer pauses, and fish near the bottom or shelters."],
    ["Warm Water","Seek oxygen: windward sides, currents, shade, drop-off edges, and dawn/dusk."],
    ["No Bites?","Change depth and retrieve speed first. Color is usually only the third adjustment."],
    ["Leader","Always use a wire/hard leader for Pike. For Zander and Perch, thin fluorocarbon can improve bite rates in clear water."]
  ];

  const tagText = currentLang === 'fi' ? 'Nyrkkisääntö' : 'Golden Rule';

  document.getElementById("lureRules").innerHTML=rules.map(([h,p])=>`<article class="tip-card"><span class="tag">${tagText}</span><h3>${h}</h3><p>${p}</p></article>`).join("");
}
function renderSpeciesButtons(){
  const host=document.getElementById("speciesButtons");
  host.innerHTML=SPECIES.map(s=>`<button class="species-btn ${s.id===spSel.value?"active":""}" data-fish="${s.id}">${s.name}</button>`).join("");
  host.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{spSel.value=b.dataset.fish;renderFishInfo(b.dataset.fish);refresh()}));
}
function renderLureSpeciesButtons(){
  const host=document.getElementById("lureSpeciesButtons");
  if(!host) return;
  const trans=UI_TRANS[currentLang];
  host.innerHTML=SPECIES.map(s=>{
    const f=FISH_INFO[s.id]||FISH_INFO.ahven;
    return `<button class="lure-pick-card" data-fish="${s.id}" type="button">
      <div class="lure-pick-visual"><img src="${f.image}" alt="${f.title}" loading="lazy" onerror="this.parentElement.innerHTML=fishSvg('${f.color}')"></div>
      <div class="lure-pick-body">
        <span class="tag">${f.mood}</span>
        <h3>${s.name}</h3>
        <p>${f.start}</p>
        <span class="lure-pick-cta">${trans.lure_pick_cta}</span>
      </div>
    </button>`;
  }).join("");
  host.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>showLureDetail(b.dataset.fish)));
}
function showLureDetail(id){
  spSel.value=id;
  renderDetailFishInfo(id);
  showPage("uistinDetail");
  refresh();
}
function renderDetailFishInfo(id=spSel.value){
  const f=FISH_INFO[id]||FISH_INFO.ahven;
  const trans=UI_TRANS[currentLang];
  document.getElementById("detailFishInfo").innerHTML=`<span class="tag">${f.mood}</span><h3 style="font-size:32px">${f.title}</h3><div class="columns"><div><p><strong>${trans.fish_where}</strong><br>${f.where}</p></div><div><p><strong>${trans.fish_when}</strong><br>${f.when}</p></div></div><div class="checklist"><div class="check"><div><b>${trans.fish_start}</b><br>${f.start}</div></div></div>`;
  document.getElementById("detailFishVisual").innerHTML=`<img src="${f.image}" alt="${f.title}" loading="lazy" onerror="this.parentElement.innerHTML=fishSvg('${f.color}')">`;
}
document.getElementById("lureBackBtn")?.addEventListener("click",()=>showPage("uistimet"));
function fishSvg(color){
  return `<svg viewBox="0 0 420 220" role="img" aria-label="Kala"><path d="M58 112C124 30 252 29 344 103c16-19 32-35 52-48v116c-20-13-36-29-52-48C250 194 126 194 58 112Z" fill="${color}"/><path d="M96 112c44-42 121-56 190-19" stroke="#ffffff" stroke-opacity=".45" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M176 73l44-45 12 61M178 148l54 46 6-70" fill="${color}" opacity=".78"/><circle cx="104" cy="104" r="8" fill="#1f2924"/><path d="M334 103c-11 8-11 13 0 20" stroke="#1f2924" stroke-opacity=".28" stroke-width="7" fill="none" stroke-linecap="round"/></svg>`;
}
function renderFishInfo(id=spSel.value){
  const f=FISH_INFO[id]||FISH_INFO.ahven;
  const whereLabel = currentLang === 'fi' ? 'Mistä etsiä:' : 'Where to look:';
  const whenLabel = currentLang === 'fi' ? 'Milloin yrittää:' : 'When to try:';
  const startLabel = currentLang === 'fi' ? 'Viehe alkuun:' : 'Starting lure:';
  const rememberLabel = currentLang === 'fi' ? 'Muista:' : 'Remember:';
  const rememberText = currentLang === 'fi' 
    ? 'Tarkista paikalliset rajoitukset, alamitat ja rauhoitukset ennen kalastusta.' 
    : 'Check local regulations, minimum sizes and closed seasons before fishing.';

  document.getElementById("fishInfo").innerHTML=`<span class="tag">${f.mood}</span><h3 style="font-size:32px">${f.title}</h3><div class="columns"><div><p><strong>${whereLabel}</strong><br>${f.where}</p></div><div><p><strong>${whenLabel}</strong><br>${f.when}</p></div></div><div class="checklist"><div class="check"><div><b>${startLabel}</b><br>${f.start}</div></div><div class="check"><div><b>${rememberLabel}</b><br>${rememberText}</div></div></div>`;
  document.getElementById("fishVisual").innerHTML=`<img src="${f.image}" alt="${f.title}" loading="lazy" onerror="this.parentElement.innerHTML=fishSvg('${f.color}')">`;
  renderSpeciesButtons();
  renderLureSpeciesButtons();
  renderFishSeasons(id);
}
function renderFishSeasons(id=spSel.value){
  const seasons = (FISH_SEASONS && FISH_SEASONS[id]) || (FISH_SEASONS && FISH_SEASONS.ahven) || [];
  const grid = document.getElementById("fishSeasonsGrid");
  if (!grid) return;
  grid.innerHTML = seasons.map(s=>`<article class="tip-card"><span class="tag">${s.label}</span><p>${s.text}</p></article>`).join("");
}
function computeScoreFromValues(vals,species,loc){
  const isSeaSummer=isSeaLocation(loc)&&isSummerMonth(new Date());
  const core=computeCoreScore({...vals,species,isSeaSummer});
  const now=new Date();
  return {score:core.score,delta:vals.delta,wind:vals.wind,cloud:vals.cloud,temp:vals.temp,moon:core.moon,speciesBonus:core.speciesBonus,isPrimeTime:vals.isPrimeTime,pressureNow:null,windCompass:"-",sunrise:now,sunset:now,isSeaSummer:core.isSeaSummer};
}
function showManualFallback(){
  document.getElementById("manualForm").classList.add("show");
  const netLabel = currentLang === 'fi' ? 'Verkko' : 'Network';
  const handLabel = currentLang === 'fi' ? 'Käsinsyöttö' : 'Manual Entry';
  const subLabel = currentLang === 'fi' 
    ? 'Automaattinen sää ei auennut. Voit silti laskea kelin käsin.' 
    : 'Automatic weather could not be loaded. You can still calculate the score manually.';

  document.getElementById("stripHost").innerHTML=`<div class="stat"><div class="label">${netLabel}</div><div class="value">${handLabel}</div><div class="sub">${subLabel}</div></div>`;
  document.getElementById("hourlyHost").innerHTML="";
  document.getElementById("bestWindow").textContent="";
  const dailyHost=document.getElementById("dailyForecastHost");
  if(dailyHost) dailyHost.innerHTML="";
  lastWeatherData=null;
  lastDailySummaries=null;
}
function updateHeroResult(info){
  const box=document.getElementById("heroResult");
  if(!box) return;
  const lbl=scoreLabel(info.score);
  document.getElementById("heroResultScore").textContent=Math.round(info.score);
  document.getElementById("heroResultLabel").textContent=lbl.text;
  document.getElementById("heroResultVerdict").textContent=verdictSentence(info);
  document.getElementById("heroResultLink").textContent=currentLang==='fi'?"Katso koko keli ja parhaat ajat ↓":"See full bite index and best times ↓";
  box.hidden=false;
}
async function refresh(){
  // Varmistetaan että käytetään oikeaa lokaatiota
  const locIndex = locSel.value;
  const loc=resolveLocation(locIndex);
  const species=spSel.value;
  
  if(!loc) return;

  const loadLabel = currentLang === 'fi' ? 'Ladataan' : 'Loading';
  const momentLabel = currentLang === 'fi' ? 'Hetki...' : 'One moment...';
  const subLabel = currentLang === 'fi' ? 'Haetaan sää- ja kelitietoja.' : 'Fetching weather and bite data.';
  const updatedLabel = currentLang === 'fi' ? 'päivitetty' : 'updated';
  const errorLabel = currentLang === 'fi' 
    ? 'Sään haku ei onnistunut. Syötä keli käsin alla olevaan lomakkeeseen.' 
    : 'Weather search failed. Please enter conditions manually in the form below.';
  const manualLabel = currentLang === 'fi' ? 'Käsin' : 'Manual';

  document.getElementById("stripHost").innerHTML=`<div class="stat"><div class="label">${loadLabel}</div><div class="value">${momentLabel}</div><div class="sub">${subLabel}</div></div>`;
  document.getElementById("manualForm").classList.remove("show");
  document.getElementById("scoreLabel").textContent=loadLabel;
  try{
    const data=await fetchWeather(loc);
    const idx=nearestHourIndex(data.hourly.time);
    const info=computeScore(data,idx,species,loc);
    info.windCompass=degToCompass(data.hourly.wind_direction_10m[idx]);
    setGauge(info.score);
    document.getElementById("verdictText").textContent=verdictSentence(info);
    renderStrip(info);
    lastInfo=info;
    renderLures(species,info);
    renderHourlyChart(buildHourlyTimeline(data,idx,species,loc));
    lastWeatherData=data;
    lastSpeciesForDaily=species;
    lastLocForDaily=loc;
    lastDailySummaries=buildDailySummaries(data,idx,species,loc,7);
    selectedDayKey=lastDailySummaries.length?lastDailySummaries[0].dateKey:null;
    renderDailyForecast(lastDailySummaries,selectedDayKey);
    renderFishInfo(species);
    updateHeroResult(info);
    document.getElementById("updatedText").textContent=`${loc.name} · ${updatedLabel} ${new Date().toLocaleTimeString(currentLang === 'fi' ? "fi-FI" : "en-US",{hour:"2-digit",minute:"2-digit"})}`;
  }catch(e){
    setGauge(0);
    document.getElementById("scoreLabel").textContent=manualLabel;
    document.getElementById("verdictText").textContent=errorLabel;
    showManualFallback();
    lastInfo=computeScoreFromValues({delta:-1,wind:4,cloud:50,temp:14,isPrimeTime:false},species,loc);
    renderLures(species,lastInfo);
    renderFishInfo(species);
    document.getElementById("heroResult").hidden=true;
  }
}
document.getElementById("refreshBtn").addEventListener("click",refresh);
locSel.addEventListener("change",refresh);
spSel.addEventListener("change",()=>{renderFishInfo(spSel.value);refresh()});
document.getElementById("mCloud").addEventListener("input",e=>document.getElementById("mCloudVal").textContent=e.target.value);
document.getElementById("mCalcBtn").addEventListener("click",()=>{
  const species=spSel.value;
  const loc=resolveLocation(locSel.value);
  const vals={delta:parseFloat(document.getElementById("mPressureDelta").value)||0,wind:parseFloat(document.getElementById("mWind").value)||0,cloud:parseFloat(document.getElementById("mCloud").value)||0,temp:parseFloat(document.getElementById("mTemp").value)||0,isPrimeTime:document.getElementById("mPrime").checked};
  const info=computeScoreFromValues(vals,species,loc);
  setGauge(info.score);
  const manualLabel = currentLang === 'fi' ? 'käsin syötetty keli' : 'manually entered weather';
  document.getElementById("verdictText").textContent=verdictSentence(info)+` (${manualLabel})`;
  renderStrip(info);
  lastInfo=info;
  renderLures(species,info);
  updateHeroResult(info);
  const manualTitle = currentLang === 'fi' ? 'Käsin syötetty keli' : 'Manually entered weather';
  document.getElementById("updatedText").textContent=`${manualTitle} · ${new Date().toLocaleTimeString(currentLang === 'fi' ? "fi-FI" : "en-US",{hour:"2-digit",minute:"2-digit"})}`;
});
function applyDeviceView() {
  const choice = storage.getItem('device_view');
  if (choice === 'phone') {
    document.body.classList.add('device-phone');
    // Ensure sticky bottom nav is shown
    let bottomNav = document.getElementById("mobileBottomNav");
    if (!bottomNav) {
      bottomNav = document.createElement("div");
      bottomNav.id = "mobileBottomNav";
      bottomNav.className = "mobile-bottom-nav";
      bottomNav.innerHTML = `
        <button class="mobile-nav-item active" data-page="kelimittari">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          <span class="m-nav-label">Keli</span>
        </button>
        <button class="mobile-nav-item" data-page="uistimet">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 1-3 3 3 3 0 0 1-3-3v-4h6"></path><circle cx="6" cy="14" r="1"></circle></svg>
          <span class="m-nav-label">Uistimet</span>
        </button>
        <button class="mobile-nav-item" data-page="kalalajit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12c4-5 11-5 15 0 2-1 4-1.5 5-1.5s-.5 2-1.5 4c1 1 1.5 3 1.5 5s-2.5 1-4.5 0c-4 4-11 4-15 0"></path><circle cx="15" cy="11" r="1" fill="currentColor"></circle></svg>
          <span class="m-nav-label">Kalat</span>
        </button>
        <button class="mobile-nav-item" data-page="varusteet">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="12" rx="2" ry="2"></rect><path d="M16 8V5a3 3 0 0 0-6 0v3"></path></svg>
          <span class="m-nav-label">Varusteet</span>
        </button>
        <button class="mobile-nav-item" data-page="oppaat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          <span class="m-nav-label">Oppaat</span>
        </button>
        <button class="mobile-nav-item" data-page="merikartta">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="18"></line><line x1="15" y1="6" x2="15" y2="21"></line></svg>
          <span class="m-nav-label">Kartta</span>
        </button>
        <button class="mobile-nav-item" data-page="feedi">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="M21 15l-5-5L5 21"></path></svg>
          <span class="m-nav-label">Saaliit</span>
        </button>
        <button class="mobile-nav-item" data-page="linkit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
          <span class="m-nav-label">Linkit</span>
        </button>
      `;
      document.body.appendChild(bottomNav);
      
      // Bind mobile nav click actions
      bottomNav.querySelectorAll(".mobile-nav-item").forEach(item => {
        item.addEventListener("click", () => {
          showPage(item.dataset.page);
        });
      });
    }
    
    // Trigger setLanguage to properly translate the newly added labels
    setLanguage(currentLang, false);
  } else {
    document.body.classList.remove('device-phone');
    const bottomNav = document.getElementById("mobileBottomNav");
    if (bottomNav) bottomNav.remove();
  }
}

function renderDeviceSelector() {
  let overlay = document.getElementById("deviceSelectorOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "deviceSelectorOverlay";
    overlay.className = "device-overlay";
    document.body.appendChild(overlay);
  }
  
  const isFi = currentLang === 'fi';
  const title = isFi ? "Valitse näkymä" : "Select View";
  const subtitle = isFi ? "Oletko puhelimella vai tietokoneella?" : "Are you on phone or computer?";
  const desc = isFi 
    ? "Optimoi näkymä laitteellesi parhaan käyttökokemuksen takaamiseksi. Voit muuttaa valintaa myöhemmin sivun alalaidasta." 
    : "Optimize the view for your device to ensure the best experience. You can switch this choice anytime in the footer.";
    
  const phoneTitle = isFi ? "📱 Puhelin" : "📱 Phone";
  const phoneTag = isFi ? "Suositellaan mobiiliin" : "Recommended";
  const phoneDesc = isFi 
    ? "Helposti peukalolla saavutettava alanavigaatio, kompaktit sääpaneelit ja isommat kosketusalueet ilman turhaa vieritystä." 
    : "Thumb-friendly bottom navigation, compact weather panels, and larger touch targets for easy scrolling.";
    
  const desktopTitle = isFi ? "💻 Tietokone" : "💻 Computer";
  const desktopTag = isFi ? "Alkuperäinen tyyli" : "Original styling";
  const desktopDesc = isFi 
    ? "Alkuperäinen työpöytäasettelu runsaalla negatiivisella tilalla, laajoilla sarakkeilla ja perinteisellä ylänavigaatiolla." 
    : "Original desktop layout with spacious padding, wide columns, and classic top navigation.";
  
  overlay.innerHTML = `
    <div class="device-modal">
      <div class="device-header">
        <h2>${title}</h2>
        <p class="device-subtitle">${subtitle}</p>
        <p class="device-desc-text">${desc}</p>
      </div>
      <div class="device-options">
        <button class="device-card-btn" id="deviceChoosePhone">
          <div class="device-card-head">
            <span class="device-card-title">${phoneTitle}</span>
            <span class="device-card-tag recommend">${phoneTag}</span>
          </div>
          <p class="device-card-desc">${phoneDesc}</p>
        </button>
        <button class="device-card-btn" id="deviceChooseDesktop">
          <div class="device-card-head">
            <span class="device-card-title">${desktopTitle}</span>
            <span class="device-card-tag">${desktopTag}</span>
          </div>
          <p class="device-card-desc">${desktopDesc}</p>
        </button>
      </div>
    </div>
  `;
  
  document.getElementById("deviceChoosePhone").addEventListener("click", () => {
    storage.setItem('device_view', 'phone');
    applyDeviceView();
    overlay.remove();
  });
  
  document.getElementById("deviceChooseDesktop").addEventListener("click", () => {
    storage.setItem('device_view', 'desktop');
    applyDeviceView();
    overlay.remove();
  });
}

setGauge(0);
setLanguage(currentLang, false);
renderConsentBanner();
initGeoLocation();

// Lämmitä pieni, sivuston mukana toimitettava paikkatiedosto selaimen ollessa vapaana.
// Kartta avautuu tämän ansiosta useimmiten heti, mutta alkusivun kriittinen lataus ei odota dataa.
const warmPotentialSpotDataset=()=>loadPotentialSpotDataset().catch(()=>{});
if ('requestIdleCallback' in window) requestIdleCallback(warmPotentialSpotDataset,{timeout:3000});
else setTimeout(warmPotentialSpotDataset,1800);

(function(){
  const switchEl=document.getElementById("intentSwitch");
  if (!switchEl) return;
  function setActiveBtn(intent){
    switchEl.querySelectorAll(".intent-btn").forEach(b=>b.classList.toggle("active", b.dataset.intent===intent));
  }
  switchEl.querySelectorAll(".intent-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const intent=btn.dataset.intent;
      storage.setItem('site_intent', intent);
      setActiveBtn(intent);
      showPage(intent);
    });
  });
  const stored=storage.getItem('site_intent');
  if (stored === 'merikartta') {
    setActiveBtn('merikartta');
    showPage('merikartta');
  }
})();

// Apply device views. Aiemmin tämä avasi koko sisällön peittävän valintaikkunan jokaisella
// ensikäynnillä (myös hakukoneiden/AdSensen tarkistusroboteilla) - sisältö ei ollut lainkaan
// näkyvissä ennen klikkausta. Nyt näkymä päätellään automaattisesti näytön leveyden perusteella,
// ja käyttäjä voi vaihtaa sen manuaalisesti alapalkin "Vaihda näkymä" -painikkeesta.
if (!storage.getItem('device_view')) {
  storage.setItem('device_view', window.innerWidth < 820 ? 'phone' : 'desktop');
}
applyDeviceView();

(function () {
  var root = document.documentElement;
  var btn = document.getElementById('themeToggleBtn');
  function setStored(theme) {
    try { localStorage.setItem('color_theme', theme); } catch (e) {}
    try {
      var d = new Date(); d.setTime(d.getTime() + 365 * 24 * 60 * 60 * 1000);
      document.cookie = 'color_theme=' + encodeURIComponent(theme) + '; expires=' + d.toUTCString() + '; path=/; SameSite=Lax';
    } catch (e) {}
  }
  if (btn) {
    btn.addEventListener('click', function () {
      var current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      var next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      setStored(next);
    });
  }
})();
