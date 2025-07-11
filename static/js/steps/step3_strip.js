import { configurazione, mappaTipologieVisualizzazione } from '../config.js';
import { updateProgressBar } from '../utils.js';
import { caricaStripLedCompatibili } from '../api.js';
import { vaiAllAlimentazione } from './step4.js';

export function initStripSelectionListeners() {
  $('#btn-torna-step3-potenza').on('click', function(e) {
    e.preventDefault();
    
    $("#step3-strip-selection").fadeOut(300, function() {
      $("#step3-temperatura-potenza").fadeIn(300);
    });
  });

  $('#btn-continua-step3-strip').on('click', function(e) {
    e.preventDefault();
    
    if (configurazione.stripLedSceltaFinale) {
      $("#step3-strip-selection").fadeOut(300, function() {
        vaiAllAlimentazione();
      });
    } else {
      alert("Seleziona un modello di strip LED prima di continuare");
    }
  });
}

export function vaiAllaSelezioneLedStrip() {
  $('#profilo-nome-step3-strip').text(configurazione.nomeModello);
  $('#tipologia-nome-step3-strip').text(mappaTipologieVisualizzazione[configurazione.tipologiaSelezionata] || configurazione.tipologiaSelezionata);
  $('#tensione-nome-step3-strip').text(configurazione.tensioneSelezionato);
  $('#ip-nome-step3-strip').text(configurazione.ipSelezionato);
  $('#temperatura-nome-step3-strip').text(configurazione.temperaturaSelezionata);
  $('#potenza-nome-step3-strip').text(configurazione.potenzaSelezionata);

  configurazione.stripLedSceltaFinale = null;
  $('#btn-continua-step3-strip').prop('disabled', true);
  $(".step-section").hide();
  $("#step3-strip-selection").fadeIn(300);

  caricaStripLedCompatibili(
    configurazione.profiloSelezionato,
    configurazione.tensioneSelezionato,
    configurazione.ipSelezionato,
    configurazione.temperaturaSelezionata,
    configurazione.potenzaSelezionata,
    configurazione.tipologiaStripSelezionata
  );
  updateProgressBar(3);
}