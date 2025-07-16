import { configurazione, mappaTipologieVisualizzazione, mappaStripLedVisualizzazione } from '../config.js';
import { updateProgressBar } from '../utils.js';
import { caricaOpzioniPotenza, caricaStripLedCompatibili } from '../api.js';
import { vaiAllAlimentazione } from './step4.js';
import { vaiAlControllo } from './step5.js';
import { vaiAllaSelezioneProfiliPerEsterni } from './step2_esterni.js';

export function initStep3Listeners() {
  $('#btn-torna-step2').on('click', function(e) {
    e.preventDefault();
    
    $("#step3-temperatura-potenza").fadeOut(300, function() {
      $("#step2-parametri").fadeIn(300);
      updateProgressBar(configurazione.isFlussoProfiliEsterni ? 3 : 3);
    });
  });
  
  $('#btn-continua-step3').on('click', function(e) {
    e.preventDefault();
    
    if (configurazione.potenzaSelezionata && configurazione.stripLedSceltaFinale) {
      // Per gli esterni, dopo aver scelto la strip, vai alla selezione del profilo
      if (configurazione.isFlussoProfiliEsterni) {
        $("#step3-temperatura-potenza").fadeOut(300, function() {
          vaiAllaSelezioneProfiliPerEsterni();
        });
      } else if (configurazione.tensioneSelezionato === '220V') {
        configurazione.alimentazioneSelezionata = 'SENZA_ALIMENTATORE';
        $("#step3-temperatura-potenza").fadeOut(300, function() {
          updateProgressBar(5);
          vaiAlControllo();
        });
      } else {
        $("#step3-temperatura-potenza").fadeOut(300, function() {
          vaiAllAlimentazione();
        });
      }
    } else {
      if (!configurazione.potenzaSelezionata) {
        alert("Seleziona una potenza prima di continuare");
      } else if (!configurazione.stripLedSceltaFinale) {
        alert("Seleziona un modello di strip LED prima di continuare");
      }
    }
  });
}

export function vaiAllaTemperaturaEPotenza() {
  if (configurazione.isFlussoProfiliEsterni) {
    // AGGIUNGI QUESTO LOG
    console.log("Caricamento potenza per esterni con parametri:", {
        temperaturaSelezionata: configurazione.temperaturaSelezionata,
        tensioneSelezionato: configurazione.tensioneSelezionato,
        ipSelezionato: configurazione.ipSelezionato,
        tipologiaStripSelezionata: configurazione.tipologiaStripSelezionata
    });
    
      caricaOpzioniPotenza('ESTERNI', configurazione.temperaturaSelezionata);
  } else {
      caricaOpzioniPotenza(configurazione.profiloSelezionato, configurazione.temperaturaSelezionata);
  }

  selezionaStripLedAutomaticamente();

  if (!configurazione.temperaturaSelezionata && configurazione.temperaturaColoreSelezionata) {
    configurazione.temperaturaSelezionata = configurazione.temperaturaColoreSelezionata;
  }
  
  // Per gli esterni, non mostrare il profilo nei badge
  if (configurazione.isFlussoProfiliEsterni) {
    $('#profilo-nome-step3').parent().hide();
    $('#tipologia-nome-step3').parent().hide();
  } else {
    $('#profilo-nome-step3').text(configurazione.nomeModello);
    $('#tipologia-nome-step3').text(mappaTipologieVisualizzazione[configurazione.tipologiaSelezionata] || configurazione.tipologiaSelezionata);
  }
  
  $('#strip-nome-step3').text(mappaStripLedVisualizzazione[configurazione.stripLedSelezionata] || configurazione.stripLedSelezionata);

  updateProgressBar(3);
  $(".step-section").hide();
  $("#step3-temperatura-potenza").fadeIn(300);

  configurazione.stripLedSceltaFinale = null;
  $('#strip-led-model-section').hide();
  $('#btn-continua-step3').prop('disabled', true);

  // Per gli esterni, carica le opzioni di potenza senza profilo selezionato
  if (configurazione.isFlussoProfiliEsterni) {
    caricaOpzioniPotenza('ESTERNI', configurazione.temperaturaSelezionata);
  } else {
    caricaOpzioniPotenza(configurazione.profiloSelezionato, configurazione.temperaturaSelezionata);
  }
}

function selezionaStripLedAutomaticamente() {
  let stripId = '';

  if (configurazione.tipologiaStripSelezionata === 'SMD') {
    stripId = `STRIP_${configurazione.tensioneSelezionato}_SMD_${configurazione.ipSelezionato}`;
  }
  else if (configurazione.tipologiaStripSelezionata === 'COB') {
    stripId = `STRIP_${configurazione.tensioneSelezionato}_COB_${configurazione.ipSelezionato}`;
  }
  else if (configurazione.temperaturaSelezionata === 'RGB') {
    if (configurazione.tipologiaStripSelezionata === 'SMD') {
      stripId = `STRIP_${configurazione.tensioneSelezionato}_RGB_SMD_${configurazione.ipSelezionato}`;
    } else if (configurazione.tipologiaStripSelezionata === 'COB') {
      stripId = `STRIP_${configurazione.tensioneSelezionato}_RGB_COB_${configurazione.ipSelezionato}`;
    }
  }
  else if (configurazione.tipologiaStripSelezionata === 'SPECIAL') {
    stripId = `STRIP_${configurazione.tensioneSelezionato}_SMD_${configurazione.ipSelezionato}`;
  }

  configurazione.stripLedSelezionata = stripId;
  configurazione.temperaturaColoreSelezionata = configurazione.temperaturaSelezionata;
}

export function initPotenzaListener() {
  $(document).off('click', '.potenza-card').on('click', '.potenza-card', function() {
    $('.potenza-card').removeClass('selected');
    $(this).addClass('selected');
    configurazione.potenzaSelezionata = $(this).data('potenza');
    configurazione.codicePotenza = $(this).data('codice');

    $('#strip-led-model-section').show();
    
    // Per gli esterni, carica le strip compatibili senza profilo
    if (configurazione.isFlussoProfiliEsterni) {
      caricaStripLedCompatibili(
        'ESTERNI',
        configurazione.tensioneSelezionato,
        configurazione.ipSelezionato,
        configurazione.temperaturaSelezionata,
        configurazione.potenzaSelezionata,
        configurazione.tipologiaStripSelezionata
      );
    } else {
      caricaStripLedCompatibili(
        configurazione.profiloSelezionato,
        configurazione.tensioneSelezionato,
        configurazione.ipSelezionato,
        configurazione.temperaturaSelezionata,
        configurazione.potenzaSelezionata,
        configurazione.tipologiaStripSelezionata
      );
    }
    
    $('#btn-continua-step3').prop('disabled', true);
  });

  $(document).off('click', '.strip-led-compatibile-card').on('click', '.strip-led-compatibile-card', function() {
    $('.strip-led-compatibile-card').removeClass('selected');
    $(this).addClass('selected');
    
    const stripId = $(this).data('strip-id');
    const nomeCommerciale = $(this).data('nome-commerciale') || '';
    
    configurazione.stripLedSceltaFinale = stripId;
    configurazione.nomeCommercialeStripLed = nomeCommerciale;
    configurazione.stripLedSelezionata = stripId;
    $('#btn-continua-step3').prop('disabled', false);
  });
}