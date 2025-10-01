import { configurazione } from './config.js';

export function updateProgressBar(step) {
  $('.step-item').removeClass('active completed');

  if (step === 0) {
    return;
  }

  // Mappatura step per flusso profili esterni
  if (configurazione.isFlussoProfiliEsterni) {
    const stepMappingEsterni = {
      2: 1,  // Step tipologia strip -> Step 1
      3: 2,  // Step parametri -> Step 2  
      4: 3,  // Step temperatura/potenza -> Step 3
      5: 4,  // Step selezione profilo -> Step 4
      6: 5,  // Step personalizzazione -> Step 5
      7: 6,  // Step proposte -> Step 6
      8: 6   // Step riepilogo -> Step 6
    };
    
    if (stepMappingEsterni[step]) {
      step = stepMappingEsterni[step];
    }
  }

  if (configurazione.modalitaConfigurazione === 'solo_strip') {
    const stepMapping = {
      2: 2,
      4: 3,
      5: 4,
      7: 5
    };
    step = stepMapping[step] || step;
  }
  
  let actualStep = step;
  if (actualStep > 5) {
    actualStep = 5;
  }

  $(`#progress-step${actualStep}`).addClass('active');

  for (let i = 1; i < actualStep; i++) {
    $(`#progress-step${i}`).addClass('completed');
  }
}

export function formatTemperatura(temperatura) {
  if (temperatura === 'CCT') {
    return 'Temperatura Dinamica (CCT)';
  } else if (temperatura === 'RGB') {
    return 'RGB Multicolore';
  } else if (temperatura === 'RGBW') {
    return 'RGBW (RGB + Bianco)';
  } else {
    return temperatura;
  }
}

export function getTemperaturaColor(temperatura) {
  switch(temperatura) {
    case '2700K':
      return '#FFE9C0';
    case '3000K':
      return '#FFF1D9';
    case '4000K':
      return '#FFFBE3';
    case '6000K':
    case '6500K':
    case '6700K':
      return '#F5FBFF';
    case 'CCT':
      return 'linear-gradient(to right, #FFE9C0, #F5FBFF)';
    case 'RGB':
      return 'linear-gradient(to right, red, green, blue)';
    case 'RGBW':
      return 'linear-gradient(to right, red, green, blue, white)';
    case 'ROSSO':
      return 'red';
    case 'VERDE':
      return 'green';
    case 'BLU':
      return 'blue';
    case 'AMBRA':
      return '#FFBF00';
    case 'PINK':
      return 'pink';
    default:
      return '#FFFFFF';
  }
}

export function checkStep2Completion() {
  let isComplete = true;
  
  if (!configurazione.profiloSelezionato) {
    isComplete = false;
  }
  
  if (!configurazione.tipologiaSelezionata) {
    isComplete = false;
  }

  if (configurazione.tipologiaSelezionata === 'profilo_intero' && 
      configurazione.lunghezzeDisponibili && 
      configurazione.lunghezzeDisponibili.length > 1 && 
      (!configurazione.lunghezzaRichiesta || configurazione.lunghezzaRichiesta === null)) {
    isComplete = false;
  }
  
  $('#btn-continua-step2').prop('disabled', !isComplete);
  return isComplete;
}

export function checkParametriCompletion() {
  if (configurazione.tensioneSelezionato && configurazione.ipSelezionato && configurazione.temperaturaSelezionata) {
    $('#btn-continua-parametri').prop('disabled', false);
  } else {
    $('#btn-continua-parametri').prop('disabled', true);
  }
}

export function checkStep5Completion() {
  let isComplete = true;

  if (configurazione.tensioneSelezionato === '220V') {
    isComplete = !!configurazione.dimmerSelezionato;
  } else {
    if (configurazione.alimentazioneSelezionata === 'SENZA_ALIMENTATORE') {
      configurazione.dimmerSelezionato = "NESSUN_DIMMER";
    } else if (!configurazione.dimmerSelezionato) {
      isComplete = false;
    }
    
    if (!configurazione.tipoAlimentazioneCavo) {
      isComplete = false;
    }
    
    if (!configurazione.uscitaCavoSelezionata) {
      isComplete = false;
    }
  }
  
  $('#btn-continua-step5').prop('disabled', !isComplete);
  return isComplete;
}

export function checkStep6Completion() {
  let isComplete = true;
  
  if (!configurazione.formaDiTaglioSelezionata) {
    isComplete = false;
  }
  
  if (!configurazione.finituraSelezionata) {
    isComplete = false;
  }
  
  if (configurazione.tipologiaSelezionata === 'taglio_misura' && !configurazione.lunghezzaRichiesta) {
    isComplete = false;
  }
  
  $('#btn-finalizza').prop('disabled', !isComplete);
}

export function checkPersonalizzazioneCompletion() {
  let isComplete = true;

  if (configurazione.tipologiaSelezionata === 'profilo_intero') {
    if (!configurazione.formaDiTaglioSelezionata) {
      configurazione.formaDiTaglioSelezionata = 'DRITTO_SEMPLICE';
    }

    if (!configurazione.finituraSelezionata) {
      isComplete = false;
    }

    if (!configurazione.lunghezzaRichiesta) {
      if (configurazione.lunghezzaProfiloIntero) {
        configurazione.lunghezzaRichiesta = configurazione.lunghezzaProfiloIntero;
      } else if (configurazione.lunghezzaSelezionata) {
        configurazione.lunghezzaRichiesta = configurazione.lunghezzaSelezionata;
      } else if (configurazione.lunghezzaMassimaProfilo) {
        configurazione.lunghezzaRichiesta = configurazione.lunghezzaMassimaProfilo;
      }
    }
  } else {
    if (!configurazione.formaDiTaglioSelezionata) {
      isComplete = false;
    }
    
    if (!configurazione.finituraSelezionata) {
      isComplete = false;
    }

    if (configurazione.tipologiaSelezionata === 'taglio_misura') {
      if (configurazione.formaDiTaglioSelezionata === 'DRITTO_SEMPLICE') {
        if (!configurazione.lunghezzaRichiesta) {
          isComplete = false;
        }
      }
      else if (configurazione.lunghezzeMultiple) {
        const forma = configurazione.formaDiTaglioSelezionata;
        const numLatiRichiesti = {
          'FORMA_L_DX': 2,
          'FORMA_L_SX': 2,
          'FORMA_C': 3,
          'RETTANGOLO_QUADRATO': 2
        }[forma] || 0;

        const latiValidi = Object.values(configurazione.lunghezzeMultiple)
          .filter(val => val && val > 0).length;
        
        if (latiValidi < numLatiRichiesti) {
          isComplete = false;
        }
      } else {
        isComplete = false;
      }
    }
  }

  // Check if tappi section is visible and requires a choice
  if ($('#tappi-container').length > 0) {
    const tappiSceltaSelected = $('.tappi-scelta-card.selected').length > 0;
    if (!tappiSceltaSelected) {
      isComplete = false;
    }
  }

  // Check if diffusore section is visible and requires a choice
  if ($('#diffusore-container').length > 0) {
    const diffusoreSceltaSelected = $('.diffusore-scelta-card.selected').length > 0;
    if (!diffusoreSceltaSelected) {
      isComplete = false;
    }
  }

  $('#btn-continua-personalizzazione').prop('disabled', !isComplete);
  return isComplete;
}
