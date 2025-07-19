import { configurazione } from './config.js';

export function calcolaCodiceProfilo() {
  if (!configurazione.profiloSelezionato) return '';
  const isSabProfile = [
    "PRF016_200SET",
    "PRF011_300"
  ].includes(configurazione.profiloSelezionato);

  const isOpqProfile = [
    "PRF120_300",
    "PRF080_200"
  ].includes(configurazione.profiloSelezionato);

  const isSpecialProfile = [
    "FWPF", "MG13X12PF", "MG12X17PF", "SNK6X12PF", "SNK10X10PF", "SNK12X20PF"
  ].includes(configurazione.profiloSelezionato)

  const isAl = (configurazione.profiloSelezionato.includes("PRFIT") || configurazione.profiloSelezionato.includes("PRF120")) && !configurazione.profiloSelezionato.includes("PRFIT321");

  let codiceProfilo;

  if (isSpecialProfile) 
  {
    codiceProfilo = configurazione.profiloSelezionato.replace(/_/g, '/');
  }
  else {
    let colorCode;
    if (configurazione.finituraSelezionata == "NERO") colorCode = 'BK';
    else if (configurazione.finituraSelezionata == "BIANCO") colorCode = 'WH';
    else if (configurazione.finituraSelezionata == "ALLUMINIO" && isAl) colorCode = 'AL';

    if (isOpqProfile) colorCode = "M" + colorCode;
    else if (isSabProfile) colorCode = "S" + colorCode;

    if (colorCode) codiceProfilo = configurazione.profiloSelezionato.replace(/_/g, '/') + ' ' + colorCode;
    else codiceProfilo = configurazione.profiloSelezionato.replace(/_/g, '/');
  }
  return codiceProfilo;
}

export function calcolaCodiceStripLed(tipologia, tensione, ip, temperatura, potenza, modello) {
    
  if (!configurazione.tensioneSelezionato || !configurazione.ipSelezionato || 
      !configurazione.temperaturaColoreSelezionata || !configurazione.tipologiaStripSelezionata || 
      !configurazione.potenzaSelezionata) {
      return '';
  }

  const mappaTemperaturaSuffisso = {
      '2700K': 'UWW',
      '3000K': 'WW',
      '4000K': 'NW',
      '6000K': 'CW',
      '6500K': 'CW',
      '6700K': 'CW',
      'RGB': 'RGB',
      'RGBW': 'RGB+WW',
      'CCT': 'CCT'
  };
  
  let stripData = null;

  if (configurazione.modalitaConfigurazione === 'solo_strip' || !configurazione.profiloSelezionato) {
      const requestData = {
          tipologia: configurazione.tipologiaStripSelezionata,
          special: configurazione.specialStripSelezionata,
          tensione: configurazione.tensioneSelezionato,
          ip: configurazione.ipSelezionato,
          temperatura: configurazione.temperaturaColoreSelezionata,
          potenza: configurazione.potenzaSelezionata
      };
      
      $.ajax({
          url: '/get_strip_led_filtrate_standalone',
          method: 'POST',
          contentType: 'application/json',
          data: JSON.stringify(requestData),
          async: false,
          success: function(response) {
              if (response.success && response.strip_led && response.strip_led.length > 0) {
                  stripData = response.strip_led.find(s => s.id === configurazione.stripLedSelezionata || s.id === configurazione.stripLedSceltaFinale);

                  if (!stripData && response.strip_led.length > 0) {
                      stripData = response.strip_led[0];
                  }
              } else {
                  console.error('Risposta API standalone non valida:', response);
              }
          },
          error: function(error) {
              console.error('Errore nel caricamento dati strip standalone:', error);
          }
      });
  } else {
      const profiloId = configurazione.profiloSelezionato;
      const tensioneParam = configurazione.tensioneSelezionato;
      const ipParam = configurazione.ipSelezionato;
      const temperaturaParam = configurazione.temperaturaColoreSelezionata;
      const tipologiaParam = configurazione.tipologiaStripSelezionata;
      const potenzaParam = configurazione.potenzaSelezionata
          .replace(' ', '-')
          .replace('/', '_');
      
      const apiUrl = `/get_strip_led_filtrate/${profiloId}/${tensioneParam}/${ipParam}/${temperaturaParam}/${potenzaParam}/${tipologiaParam}`;
      
      $.ajax({
          url: apiUrl,
          method: 'GET',
          async: false,
          success: function(response) {
              if (response.success && response.strip_led) {
                  stripData = response.strip_led.find(s => s.id === configurazione.stripLedSelezionata);
              } else {
                  console.error('Risposta API non valida:', response);
              }
          },
          error: function(error) {
              console.error('Errore nel caricamento dati strip:', error);
          }
      });
  }
  
  if (!stripData) {
      console.error('stripData è null o undefined');
      return '';
  }
  
  if (!stripData.potenzeDisponibili || !stripData.codiciProdotto) {
      console.error('Arrays mancanti:', {
          potenzeDisponibili: stripData.potenzeDisponibili,
          codiciProdotto: stripData.codiciProdotto
      });
      return '';
  }
  
  if (stripData.potenzeDisponibili.length !== stripData.codiciProdotto.length) {
      console.warn('Arrays di lunghezza diversa:', {
          potenzeLength: stripData.potenzeDisponibili.length,
          codiciLength: stripData.codiciProdotto.length
      });
  }
  
  let indicePotenza = stripData.potenzeDisponibili.indexOf(configurazione.potenzaSelezionata);

  if (indicePotenza === -1) {
      for (let i = 0; i < stripData.potenzeDisponibili.length; i++) {
          if (stripData.potenzeDisponibili[i].toLowerCase().replace(/\s/g, '') === 
              configurazione.potenzaSelezionata.toLowerCase().replace(/\s/g, '')) {
              indicePotenza = i;
              break;
          }
      }
      
      if (indicePotenza === -1) {
          return '';
      }
  }
  
  let codiceCompleto = '';
  
  if (indicePotenza < stripData.codiciProdotto.length) {
      codiceCompleto = stripData.codiciProdotto[indicePotenza];
  } else {
      console.error('Indice potenza fuori range per codiciProdotto');
      return '';
  }
  
  if (!codiceCompleto) {
      console.error('Codice completo è vuoto');
      return '';
  }
  
  configurazione.codiceProdottoCompleto = codiceCompleto;
  
  const suffissoTemp = mappaTemperaturaSuffisso[configurazione.temperaturaColoreSelezionata];
  codiceCompleto = codiceCompleto + suffissoTemp;

  if (configurazione.potenzaSelezionata.includes('CRI90')) codiceCompleto = codiceCompleto + 'CRI90';
  if (configurazione.ipSelezionato == 'IP65' && configurazione.codiceProdottoCompleto.includes('XTP') && !codiceCompleto.includes('65')) codiceCompleto = codiceCompleto + '65';
  if (configurazione.ipSelezionato == 'IP67' && !codiceCompleto.includes('67') && !configurazione.codiceProdottoCompleto.includes('MG') && !configurazione.codiceProdottoCompleto.includes('SNK')) codiceCompleto = codiceCompleto + '67';
  if (configurazione.nomeCommercialeStripLed && configurazione.nomeCommercialeStripLed.includes('FROST')) codiceCompleto = codiceCompleto + 'FR';
  if (configurazione.nomeCommercialeStripLed && configurazione.nomeCommercialeStripLed.includes('CLEAR')) codiceCompleto = codiceCompleto + 'CL';
  if (configurazione.tensioneSelezionato == '48V') codiceCompleto = codiceCompleto + '48';
  if (configurazione.tensioneSelezionato == '220V') codiceCompleto = codiceCompleto + '220';

  return codiceCompleto;
}

export function calcolaCodiceAlimentatore() {
  if (!configurazione.tipologiaAlimentatoreSelezionata || !configurazione.alimentazioneSelezionata) {
    return '';
  }
  
  let codiceAlimentatore = '';

  $.ajax({
    url: `/get_dettagli_alimentatore/${configurazione.tipologiaAlimentatoreSelezionata}`,
    method: 'GET',
    async: false,
    success: function(response) {
      if (response.success && response.alimentatore && response.alimentatore.codici) {
        const potenzaStr = configurazione.potenzaAlimentatoreSelezionata.toString();
        codiceAlimentatore = response.alimentatore.codici[potenzaStr] || '';
      }
    },
    error: function(error) {
      console.warn('Impossibile ottenere il codice alimentatore:', error);
    }
  });

  return codiceAlimentatore;
}  

export function calcolaCodiceDimmer() {
  if (!configurazione.dimmerSelezionato || configurazione.dimmerSelezionato === 'NESSUN_DIMMER') {
    return '';
  }

  const codiciDimmer = {
    "DIMMER_TOUCH_SU_PROFILO_PRFTSW01": "PRFTSW01",
    "DIMMER_TOUCH_SU_PROFILO_PRFTDIMM01": "PRFTDIMM01",
    "DIMMER_TOUCH_SU_PROFILO_PRFIRSW01": "PRFIRSW01",
    "DIMMER_TOUCH_SU_PROFILO_PRFIRDIMM01": "PRFIRDIMM01",
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

  return ' - ' + codiciDimmer[configurazione.dimmerSelezionato] || '';
}

  export function calcolaCodiceProdottoCompleto() {

	const codici = {
	  profilo: calcolaCodiceProfilo(),
	  stripLed: calcolaCodiceStripLed(
		configurazione.tipologiaStripSelezionata,
		configurazione.tensioneSelezionato,
		configurazione.ipSelezionato,
		configurazione.temperaturaSelezionata,
		configurazione.potenzaSelezionata,
		configurazione.stripLedSelezionata
	  ),
	  alimentatore: calcolaCodiceAlimentatore(),
	  dimmer: calcolaCodiceDimmer()
	};
	return codici;
  }