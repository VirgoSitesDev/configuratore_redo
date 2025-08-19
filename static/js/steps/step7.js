import { richiediPreventivo } from '../api.js';
import { updateProgressBar } from '../utils.js';
import { configurazione } from '../config.js';
import { generaPDF } from '../pdf.js';

export function initStep7Listeners() {
  $('#btn-torna-step6').on('click', function(e) {
    e.preventDefault();
    
    $("#step7-riepilogo").fadeOut(300, function() {
      if (configurazione.stripLedSelezionata === 'NO_STRIP' || 
          configurazione.stripLedSelezionata === 'senza_strip' || 
          configurazione.includeStripLed === false) {

        if (configurazione.isFlussoProfiliEsterni) {
          $("#step2-personalizzazione").fadeIn(300);
          updateProgressBar(5);
        } else {
          $("#step2-personalizzazione").fadeIn(300);
          updateProgressBar(2);
        }
      } else {
        $("#step6-proposte").fadeIn(300);
        updateProgressBar(6);
      }
    });
  });
}

export function initRiepilogoOperationsListeners(codiceProdotto) {
  // Gestione salvataggio configurazione (PDF)
  $('#btn-salva-configurazione').off('click').on('click', function() {
    generaPDF(codiceProdotto, configurazione);
  });
  
  // Gestione richiesta preventivo
  $('#btn-preventivo').off('click').on('click', function() {
    richiediPreventivo(codiceProdotto);
  });
}