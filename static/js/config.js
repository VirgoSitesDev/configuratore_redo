const configurazione = {
	categoriaSelezionata: null,
	profiloSelezionato: null,
	tipologiaSelezionata: null,
	tipologiaStripSelezionata: null,
 	specialStripSelezionata: null, 
	tensioneSelezionato: null,
	ipSelezionato: null,
	temperaturaSelezionata: null,
	stripLedSelezionata: null,
	temperaturaColoreSelezionata: null,
	potenzaSelezionata: null,
	alimentazioneSelezionata: null,
	tipologiaAlimentatoreSelezionata: null,
	dimmerSelezionato: null,
	isFlussoProfiliEsterni: false,
	tipoAlimentazioneCavo: null,
	lunghezzaCavoIngresso: null,
	lunghezzaCavoUscita: null,
	uscitaCavoSelezionata: null,
	formaDiTaglioSelezionata: null,
	finituraSelezionata: null,
	lunghezzaRichiesta: null,
	lunghezzeMultiple: {},
	lunghezzaStandard: null,
  	lunghezzeDisponibili: [],
  	lunghezzaProfiloIntero: null,
	proposta1: null,
	proposta2: null,
	codiceModello: null,
	nomeModello: null,
	modalitaConfigurazione: null,
	nomeCommercialeStripLed: null,
	codicePotenza: null,
	stripLedSceltaFinale: null,
	lunghezzaMassimaProfilo: null,
	potenzaAlimentatoreSelezionata: null,
	potenzaConsigliataAlimentatore: null,
	dimmerCodice: null,
	dimmerPotenzaMax: null,
	spazioProduzione: 5,
	lunghezzaSelezionata: null,
	propostePerLato: null,
	combinazioni: null
};

  const mappaCategorieVisualizzazione = {
	'nanoprofili': 'Nanoprofili',
	'incasso': 'Profili a Incasso',
	'sospensione': 'Profili a Sospensione',
	'plafone': 'Profili a Plafone',
	'parete': 'Profili a Parete',
	'particolari': 'Profili Particolari',
	'scalino': 'Profili a Scalino',
	'wall_washer': 'Profili Wallwasher',
	'wall_washer_ext': 'Profili Wallwasher da Esterni',
	'esterni': 'Profili per Strip LED da Esterni',
  };
  
  const mappaTipologieVisualizzazione = {
	'taglio_misura': 'Taglio su misura',
	'profilo_intero': 'Profilo intero'
  };
  
  const mappaStripLedVisualizzazione = {
	'senza_strip': 'Senza Strip LED',
	'STRIP_24V_SMD_IP20': 'STRIP 24V SMD (IP20)',
	'STRIP_24V_COB_IP20_HIGH': 'STRIP 24V COB (IP20) HIGH POWER',
	'STRIP_24V_SMD_IP66': 'STRIP 24V SMD (IP66)',
	'STRIP_24V_COB_IP20': 'STRIP 24V COB (IP20)',
	'STRIP_24V_COB_IP66': 'STRIP 24V COB (IP66)',
	'STRIP_48V_SMD_IP20': 'STRIP 48V SMD (IP20)',
	'STRIP_48V_SMD_IP66': 'STRIP 48V SMD (IP66)',
	'STRIP_24V_RGB_SMD_IP20': 'STRIP 24V RGB SMD (IP20)',
	'STRIP_24V_RGB_SMD_IP66': 'STRIP 24V RGB SMD (IP66)',
	'STRIP_24V_RGB_COB_IP20': 'STRIP 24V RGB COB (IP20)',
	'STRIP_24V_RGB_COB_IP66': 'STRIP 24V RGB COB (IP66)',
	'STRIP_220V_COB_IP20': 'STRIP 220V COB (IP20)',
	'STRIP_220V_COB_IP66': 'STRIP 220V COB (IP66)',
  };
  
  const mappaFormeTaglio = {
	'DRITTO_SEMPLICE': 'Dritto semplice',
	'FORMA_L_DX': 'Forma a L DX',
	'FORMA_L_SX': 'Forma a L SX',
	'FORMA_C': 'Forma a C',
	'RETTANGOLO_QUADRATO': 'Rettangolo/Quadrato'
  };
  
  const mappaFiniture = {
	'ALLUMINIO_ANODIZZATO': 'Alluminio anodizzato',
	'BIANCO': 'Bianco',
	'NERO': 'Nero',
	'ALLUMINIO': 'Alluminio'
  };
  
  const mappaTensioneVisualizzazione = {
	'24V': '24V',
	'48V': '48V',
	'220V': '220V'
  };
  
  const mappaIPVisualizzazione = {
	'IP20': 'IP20 (Interni)',
	'IP65': 'IP65 (Resistente all\'umidità)',
	'IP66': 'IP66 (Resistente all\'acqua)',
	'IP67': 'IP67 (Esterni)'
  };

  const mappaTipologiaStripVisualizzazione = {
	'COB': 'COB (Chip On Board)',
	'SMD': 'SMD (Surface Mount Device)',
	'SPECIAL': 'Special Strip'
  };

  const mappaSpecialStripVisualizzazione = {
	'XFLEX': 'XFLEX',
	'RUNNING': 'RUNNING',
	'ZIG_ZAG': 'ZIG ZAG',
	'XSNAKE': 'XSNAKE',
	'XMAGIS': 'XMAGIS'
  };

const mappaDimmerVisualizzazione = {
	"NESSUN_DIMMER": "Nessun dimmer",
	"DIMMER_TOUCH_SU_PROFILO_PRFTSW01": "Dimmer touch su profilo - On/Off",
	"DIMMER_TOUCH_SU_PROFILO_PRFTDIMM01": "Dimmer touch su profilo - Dimmerabile",
	"DIMMER_TOUCH_SU_PROFILO_PRFIRSW01": "Dimmer IR su profilo - On/Off",
	"DIMMER_TOUCH_SU_PROFILO_PRFIRDIMM01": "Dimmer IR su profilo - Dimmerabile",
	"DIMMER_PWM_CON_TELECOMANDO_RGB_RGBW": "Dimmer PWM con telecomando RGB + RGBW",
	"DIMMER_PWM_CON_TELECOMANDO_MONOCOLORE": "Dimmer PWM con telecomando monocolore",
	"DIMMER_PWM_CON_TELECOMANDO_TUNABLE_WHITE": "Dimmer PWM con telecomando tunable white",
	"DIMMER_PWM_CON_PULSANTE_24V_MONOCOLORE": "Dimmer PWM con pulsante 24V monocolore",
	"DIMMER_PWM_CON_PULSANTE_48V_MONOCOLORE": "Dimmer PWM con pulsante 48V monocolore",
	"DIMMERABILE_PWM_CON_SISTEMA_TUYA_MONOCOLORE": "Dimmerabile PWM con sistema TUYA monocolore",
	"DIMMERABILE_PWM_CON_SISTEMA_TUYA_TUNABLE_WHITE": "Dimmerabile PWM con sistema TUYA tunable white",
	"DIMMERABILE_PWM_CON_SISTEMA_TUYA_RGB": "Dimmerabile PWM con sistema TUYA RGB",
	"DIMMERABILE_PWM_CON_SISTEMA_TUYA_RGBW": "Dimmerabile PWM con sistema TUYA RGBW",
	"DIMMERABILE_TRIAC_PULSANTE_TUYA_220V": "Dimmerabile TRIAC pulsante + TUYA 220V",
	"DIMMER_PWM_DA_SCATOLA_CON_PULSANTE_NA": "Dimmer PWM da scatola con pulsante N.A."
  };

  function getDimmerCode(dimmerId) {
	if (!dimmerId) return "";
	if (dimmerId.includes("PRFTSW01")) return "PRFTSW01";
	if (dimmerId.includes("PRFTDIMM01")) return "PRFTDIMM01";
	if (dimmerId.includes("PRFIRSW01")) return "PRFIRSW01";
	if (dimmerId.includes("PRFIRDIMM01")) return "PRFIRDIMM01";

	const dimmerCodes = {
	  "DIMMER_PWM_CON_TELECOMANDO_RGB_RGBW": "CTR104",
	  "DIMMER_PWM_CON_TELECOMANDO_MONOCOLORE": "CTR114",
	  "DIMMER_PWM_CON_TELECOMANDO_TUNABLE_WHITE": "CTR124",
	  "DIMMER_PWM_CON_PULSANTE_24V_MONOCOLORE": "CTR125",
	  "DIMMER_PWM_CON_PULSANTE_48V_MONOCOLORE": "CTR129",
	  "DIMMERABILE_PWM_CON_SISTEMA_TUYA_MONOCOLORE": "CTR002SCTY",
	  "DIMMERABILE_PWM_CON_SISTEMA_TUYA_TUNABLE_WHITE": "CTR003CCTTY",
	  "DIMMERABILE_PWM_CON_SISTEMA_TUYA_RGB": "CTR004RGB2TY",
	  "DIMMERABILE_PWM_CON_SISTEMA_TUYA_RGBW": "CTR005RGBWTY",
	  "DIMMERABILE_TRIAC_PULSANTE_TUYA_220V": "CTR130",
	  "DIMMER_PWM_DA_SCATOLA_CON_PULSANTE_NA": "CTR050IT"
	};
	
	return dimmerCodes[dimmerId] || "";
  }

  export {
	configurazione,
	mappaCategorieVisualizzazione,
	mappaTipologieVisualizzazione,
	mappaStripLedVisualizzazione,
	mappaFormeTaglio,
	mappaFiniture,
	mappaTensioneVisualizzazione,
	mappaIPVisualizzazione,
	mappaTipologiaStripVisualizzazione,
	mappaSpecialStripVisualizzazione,
	mappaDimmerVisualizzazione,
	getDimmerCode
  };