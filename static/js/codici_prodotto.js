import { configurazione } from './config.js';

export function calcolaCodiceProfilo() {
  if (!configurazione.profiloSelezionato || !configurazione.finituraSelezionata) return '';

  // Determine the length to use - preserve existing quantity/combination logic
  let lunghezzaDaUsare = configurazione.lunghezzaRichiesta;

  if (configurazione.combinazioneProfiloOttimale && configurazione.combinazioneProfiloOttimale.length > 0) {
    const lunghezze = configurazione.combinazioneProfiloOttimale.map(combo => combo.lunghezza);
    lunghezzaDaUsare = Math.max(...lunghezze);
  }

  // Round up to nearest available standard length if applicable
  if (lunghezzaDaUsare && lunghezzaDaUsare > 0) {
    if (configurazione.lunghezzeDisponibili && configurazione.lunghezzeDisponibili.length > 0) {
      const lunghezzeOrdinate = [...configurazione.lunghezzeDisponibili].sort((a, b) => a - b);
      const lunghezzaPerEccesso = lunghezzeOrdinate.find(l => l >= lunghezzaDaUsare);

      if (lunghezzaPerEccesso) {
        lunghezzaDaUsare = lunghezzaPerEccesso;
      } else {
        lunghezzaDaUsare = Math.max(...lunghezzeOrdinate);
      }

      console.log(`Lunghezza richiesta: ${configurazione.lunghezzaRichiesta}mm, Lunghezze disponibili: [${lunghezzeOrdinate.join(', ')}], Lunghezza scelta: ${lunghezzaDaUsare}mm`);
    }
  }

  // Get the code from backend using profili_test table
  let codiceProfilo = '';

  if (lunghezzaDaUsare) {
    $.ajax({
      url: `/get_codice_profilo/${configurazione.profiloSelezionato}/${configurazione.finituraSelezionata}/${lunghezzaDaUsare}`,
      method: 'GET',
      async: false,
      success: function(response) {
        if (response.success && response.codice) {
          codiceProfilo = response.codice;
        } else {
          console.error('Failed to get profile code from backend');
        }
      },
      error: function(error) {
        console.error('Error getting profile code:', error);
      }
    });
  }

  return codiceProfilo;
}

export function calcolaCodiceStripLed(tipologia, tensione, ip, temperatura, potenza, modello) {
    
  if (!configurazione.tensioneSelezionato || !configurazione.ipSelezionato || 
      !configurazione.tipologiaStripSelezionata || 
      !configurazione.potenzaSelezionata) {
      return '';
  }

  if (!configurazione.temperaturaColoreSelezionata && configurazione.temperaturaSelezionata) {
    configurazione.temperaturaColoreSelezionata = configurazione.temperaturaSelezionata;
  }

  if (!configurazione.temperaturaColoreSelezionata) {
    console.warn('temperaturaColoreSelezionata non impostata');
    return '';
  }

  let stripData = null;

  if (configurazione.modalitaConfigurazione === 'solo_strip' || 
      !configurazione.profiloSelezionato || 
      configurazione.isFlussoProfiliEsterni) {
      
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
      console.error('stripData è null o undefined - Parametri:', {
          tipologia: configurazione.tipologiaStripSelezionata,
          tensione: configurazione.tensioneSelezionato,
          ip: configurazione.ipSelezionato,
          temperatura: configurazione.temperaturaColoreSelezionata,
          potenza: configurazione.potenzaSelezionata,
          stripSelezionata: configurazione.stripLedSelezionata,
          isEsterni: configurazione.isFlussoProfiliEsterni
      });
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
          console.error('Potenza non trovata negli array:', {
              potenzaSelezionata: configurazione.potenzaSelezionata,
              potenzeDisponibili: stripData.potenzeDisponibili
          });
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

  // The codice_completo from database is already complete - no need to add anything
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