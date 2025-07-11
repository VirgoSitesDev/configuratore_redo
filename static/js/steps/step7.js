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

        $("#step2-personalizzazione").fadeIn(300);
        updateProgressBar(2);
      } else {
        $("#step6-proposte").fadeIn(300);
        updateProgressBar(6);
      }
    });
  });
}

export function initRiepilogoOperationsListeners(codiceProdotto) {
  $('#btn-salva-configurazione').on('click', function() {
    generaPDF(codiceProdotto, configurazione);
  });
  
  $('#btn-preventivo').on('click', function() {
    richiediPreventivo(codiceProdotto);
  });
}