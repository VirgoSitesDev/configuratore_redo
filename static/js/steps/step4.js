import { configurazione, mappaTipologieVisualizzazione, mappaStripLedVisualizzazione } from '../config.js';
import { updateProgressBar } from '../utils.js';
import { caricaOpzioniAlimentatore } from '../api.js';
import { vaiAlControllo } from './step5.js';

export function initStep4Listeners() {
  $('#btn-torna-step3').on('click', function(e) {
    e.preventDefault();
    
    if (configurazione.modalitaConfigurazione === 'solo_strip') {
      $("#step4-alimentazione").fadeOut(300, function() {
        $("#step2b-potenza-lunghezza").fadeIn(300);
        updateProgressBar(2);
      });
    } else if (configurazione.isFlussoProfiliEsterni) {
      $("#step4-alimentazione").fadeOut(300, function() {
        $("#step2-personalizzazione").fadeIn(300);
        updateProgressBar(5);
      });
    } else {
      $("#step4-alimentazione").fadeOut(300, function() {
        $("#step3-temperatura-potenza").fadeIn(300);
        updateProgressBar(3);
      });
    }
  });
  
  $('#btn-continua-step4').on('click', function(e) {
    e.preventDefault();
    
    if (!checkStep4Completion()) {
      let messaggi = [];
      
      if (!configurazione.alimentazioneSelezionata) {
        messaggi.push("il tipo di alimentazione");
      } else if (configurazione.alimentazioneSelezionata !== 'SENZA_ALIMENTATORE') {
        if (!configurazione.tipologiaAlimentatoreSelezionata) {
          messaggi.push("la tipologia di alimentatore");
        }
        
        if (!configurazione.potenzaAlimentatoreSelezionata) {
          messaggi.push("la potenza dell'alimentatore");
        }
      }
      
      alert("Seleziona " + messaggi.join(", ") + " prima di continuare");
      return;
    }

    $("#step4-alimentazione").fadeOut(300, function() {
      $("#step5-controllo").fadeIn(300);
      vaiAlControllo();
    });
  });
}

function calcolaPotenzaAlimentatoreConsigliata() {
  if (configurazione.stripLedSelezionata === 'senza_strip' || 
      configurazione.stripLedSelezionata === 'NO_STRIP' || 
      !configurazione.potenzaSelezionata) {
    $('#potenza-consigliata-section').hide();
    return;
  }

  let potenzaPerMetro = 0;
  const potenzaMatch = configurazione.potenzaSelezionata.match(/(\d+(\.\d+)?)/);
  if (potenzaMatch && potenzaMatch[1]) {
    potenzaPerMetro = parseFloat(potenzaMatch[1]);
  }

  let lunghezzaMetri = 0;
  if (configurazione.lunghezzaRichiesta) {
    lunghezzaMetri = parseFloat(configurazione.lunghezzaRichiesta) / 1000;
  } else if (configurazione.lunghezzaSelezionata) {
    lunghezzaMetri = parseFloat(configurazione.lunghezzaSelezionata) / 1000;
  }

  if (potenzaPerMetro > 0 && lunghezzaMetri > 0) {
    $.ajax({
      url: '/calcola_potenza_alimentatore',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        potenzaPerMetro: potenzaPerMetro,
        lunghezzaMetri: lunghezzaMetri
      }),
      success: function(response) {
        if (response.success) {
          $('#potenza-consigliata').text(response.potenzaConsigliata);
          $('#potenza-consigliata-section').show();

          configurazione.potenzaConsigliataAlimentatore = response.potenzaConsigliata;
        }
      },
      error: function(error) {
        console.error("Errore nel calcolo della potenza dell'alimentatore:", error);
        $('#potenza-consigliata-section').hide();
      }
    });
  } else {
    $('#potenza-consigliata-section').hide();
  }
}

export function vaiAllAlimentazione() { 
  $(".step-section").hide();
  
  if (configurazione.modalitaConfigurazione === 'solo_strip') {
    $('#profilo-nome-step4').parent().hide();
    $('#tipologia-nome-step4').parent().hide();
  } else {
    $('#profilo-nome-step4').text(configurazione.nomeModello);
    $('#tipologia-nome-step4').text(mappaTipologieVisualizzazione[configurazione.tipologiaSelezionata] || configurazione.tipologiaSelezionata);
  }
  
  if (configurazione.stripLedSelezionata !== 'senza_strip' && configurazione.stripLedSelezionata !== 'NO_STRIP') {
    const nomeStripLed = configurazione.nomeCommercialeStripLed || 
                        mappaStripLedVisualizzazione[configurazione.stripLedSelezionata] || 
                        configurazione.stripLedSelezionata;
    
    $('#strip-nome-step4').text(nomeStripLed);

    if (configurazione.potenzaSelezionata) {
      $('#potenza-nome-step4').text(configurazione.potenzaSelezionata);
      $('#badge-potenza-step4').show();
    } else {
      $('#badge-potenza-step4').hide();
    }
  } else {
    $('#strip-nome-step4').text('Senza Strip LED');
    $('#badge-potenza-step4').hide();
  }
  
  updateProgressBar(4);
  $("#step4-alimentazione").fadeIn(300);

  if (configurazione.tensioneSelezionato === '220V') {
    $('#alimentazione-container').html(`
      <div class="alert alert-info mb-3">
        <strong>Nota:</strong> Per strip LED 220V non è necessario un alimentatore aggiuntivo, in quanto si collegano direttamente alla rete elettrica.
      </div>
      <div class="row">
        <div class="col-md-4 mb-3">
          <div class="card option-card alimentazione-card selected" data-alimentazione="SENZA_ALIMENTATORE">
            <div class="card-body text-center">
              <h5 class="card-title">Senza alimentatore</h5>
              <p class="card-text small text-muted">Strip LED 220V (collegamento diretto)</p>
            </div>
          </div>
        </div>
      </div>
    `);
    
    configurazione.alimentazioneSelezionata = "SENZA_ALIMENTATORE";
    $('#alimentatore-section').hide();
    $('#potenza-alimentatore-section').hide();
    $('#btn-continua-step4').prop('disabled', false);
  }

  prepareAlimentazioneListeners();

  if (configurazione.modalitaConfigurazione === 'solo_strip' && 
      configurazione.potenzaSelezionata && 
      configurazione.lunghezzaRichiestaMetri) {

    const potenzaMatch = configurazione.potenzaSelezionata.match(/(\d+(?:\.\d+)?)/);
    if (potenzaMatch) {
      const potenzaPerMetro = parseFloat(potenzaMatch[1]);
      const lunghezzaMetri = configurazione.lunghezzaRichiestaMetri;
      const potenzaTotale = potenzaPerMetro * lunghezzaMetri * 1.2;
      const potenzaConsigliata = Math.max(20, Math.ceil(potenzaTotale / 5) * 5);
      
      configurazione.potenzaConsigliataAlimentatore = potenzaConsigliata;

      $('#potenza-consigliata').text(potenzaConsigliata);
      $('#potenza-consigliata-section').show();
    }
  } else if (configurazione.stripLedSelezionata === 'senza_strip' || 
             configurazione.stripLedSelezionata === 'NO_STRIP' ||
             !configurazione.potenzaSelezionata) {
    $('#potenza-consigliata-section').hide();
  } else {
    calcolaPotenzaAlimentatoreConsigliata();
  }
}

export function prepareAlimentazioneListeners() {

  $(document).off('click', '.alimentazione-card');
  $(document).off('click', '.alimentatore-card');  
  $(document).off('click', '.potenza-alimentatore-card');

  configurazione.alimentazioneSelezionata = null;
  configurazione.tipologiaAlimentatoreSelezionata = null;
  configurazione.potenzaAlimentatoreSelezionata = null;
  
  $('#alimentatore-section').hide();
  $('#potenza-alimentatore-section').hide();
  
  $('#btn-continua-step4').prop('disabled', true);
  
  $('.alimentazione-card').removeClass('selected');

  const isRGBStrip = 
    (configurazione.stripLedSelezionata && configurazione.stripLedSelezionata.includes('RGB')) || 
    configurazione.temperaturaColoreSelezionata === 'RGB' || 
    configurazione.temperaturaColoreSelezionata === 'RGBW';

  let alimentazioneHtml = '';
  
  if (isRGBStrip) {
    alimentazioneHtml = `
      <div class="col-md-6 mb-3">
        <div class="card option-card alimentazione-card" data-alimentazione="ON-OFF">
          <div class="card-body text-center">
            <h5 class="card-title">ON/OFF</h5>
            <p class="card-text small text-muted">Alimentazione standard ON/OFF</p>
          </div>
        </div>
      </div>
      
      <div class="col-md-6 mb-3">
        <div class="card option-card alimentazione-card" data-alimentazione="SENZA_ALIMENTATORE">
          <div class="card-body text-center">
            <h5 class="card-title">Senza alimentatore</h5>
            <p class="card-text small text-muted">Configurazione senza alimentatore incluso</p>
          </div>
        </div>
      </div>
    `;
  } else {
    alimentazioneHtml = `
      <div class="col-md-4 mb-3">
        <div class="card option-card alimentazione-card" data-alimentazione="ON-OFF">
          <div class="card-body text-center">
            <h5 class="card-title">ON/OFF</h5>
            <p class="card-text small text-muted">Alimentazione standard ON/OFF</p>
          </div>
        </div>
      </div>
      
      <div class="col-md-4 mb-3">
        <div class="card option-card alimentazione-card" data-alimentazione="DIMMERABILE_TRIAC">
          <div class="card-body text-center">
            <h5 class="card-title">Dimmerabile TRIAC</h5>
            <p class="card-text small text-muted">Alimentazione con controllo dell'intensità luminosa TRIAC</p>
          </div>
        </div>
      </div>
      
      <div class="col-md-4 mb-3">
        <div class="card option-card alimentazione-card" data-alimentazione="SENZA_ALIMENTATORE">
          <div class="card-body text-center">
            <h5 class="card-title">Senza alimentatore</h5>
            <p class="card-text small text-muted">Configurazione senza alimentatore incluso</p>
          </div>
        </div>
      </div>
    `;
  }

  $('#alimentazione-container').html(alimentazioneHtml);

  const opzioniAlimentazione = $('.alimentazione-card');
  if (opzioniAlimentazione.length === 1) {
    const $unicaAlimentazione = $(opzioniAlimentazione[0]);
    $unicaAlimentazione.addClass('selected');
    const alimentazione = $unicaAlimentazione.data('alimentazione');
    configurazione.alimentazioneSelezionata = alimentazione;
    
    if (alimentazione === 'SENZA_ALIMENTATORE') {
      $('#alimentatore-section').hide();
      $('#potenza-alimentatore-section').hide();
      configurazione.tipologiaAlimentatoreSelezionata = null;
      configurazione.potenzaAlimentatoreSelezionata = null;
      
      $('#btn-continua-step4').prop('disabled', false);
    } else {
      caricaOpzioniAlimentatore(alimentazione);
      
      $('#alimentatore-section').show();
      $('#potenza-alimentatore-section').hide();
      $('#btn-continua-step4').prop('disabled', true);
    }
  } else {
    configurazione.alimentazioneSelezionata = null;
    $('#alimentatore-section').hide();
    $('#potenza-alimentatore-section').hide();
    $('#btn-continua-step4').prop('disabled', true);
  }

  $(document).on('click', '.alimentazione-card', function() {
    $('.alimentazione-card').removeClass('selected');
    $(this).addClass('selected');
    
    const alimentazione = $(this).data('alimentazione');
    configurazione.alimentazioneSelezionata = alimentazione;
    
    if (alimentazione === 'SENZA_ALIMENTATORE') {
      $('#alimentatore-section').hide();
      $('#potenza-alimentatore-section').hide();
      configurazione.tipologiaAlimentatoreSelezionata = null;
      configurazione.potenzaAlimentatoreSelezionata = null;
      
      $('#btn-continua-step4').prop('disabled', false);
    } else {
      caricaOpzioniAlimentatore(alimentazione);
      
      $('#alimentatore-section').show();
      $('#potenza-alimentatore-section').hide();
      $('#btn-continua-step4').prop('disabled', true);
    }
  });

  $(document).on('click', '.alimentatore-card', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    $('.alimentatore-card').removeClass('selected');
    $(this).addClass('selected');
    
    const alimentatoreId = $(this).data('alimentatore');
    configurazione.tipologiaAlimentatoreSelezionata = alimentatoreId;
    
    caricaPotenzeAlimentatore(alimentatoreId);
  });

  $(document).on('click', '.potenza-alimentatore-card', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    $('.potenza-alimentatore-card').removeClass('selected');
    $(this).addClass('selected');
    
    configurazione.potenzaAlimentatoreSelezionata = $(this).data('potenza');
    $('#btn-continua-step4').prop('disabled', false);
  });

  configurazione.compatibilitaAlimentazioneDimmer = {
    'ON-OFF': ['NESSUN_DIMMER'],
    'DIMMERABILE_TRIAC': ['NESSUN_DIMMER', 'DIMMER_A_PULSANTE_SEMPLICE'],
    'SENZA_ALIMENTATORE': ['NESSUN_DIMMER']
  };

  if (configurazione.stripLedSelezionata && 
      (configurazione.stripLedSelezionata.includes('RGB') || 
       configurazione.temperaturaColoreSelezionata === 'RGB' || 
       configurazione.temperaturaColoreSelezionata === 'RGBW')) {
    
    configurazione.compatibilitaAlimentazioneDimmer['ON-OFF'].push('CON_TELECOMANDO', 'CENTRALINA_TUYA');
    configurazione.compatibilitaAlimentazioneDimmer['DIMMERABILE_TRIAC'].push('CON_TELECOMANDO', 'CENTRALINA_TUYA');
    configurazione.compatibilitaAlimentazioneDimmer['SENZA_ALIMENTATORE'].push('CON_TELECOMANDO', 'CENTRALINA_TUYA');
  }

  if (configurazione.stripLedSelezionata &&
      !configurazione.stripLedSelezionata.includes('RGB') &&
      configurazione.temperaturaColoreSelezionata !== 'RGB' &&
      configurazione.temperaturaColoreSelezionata !== 'RGBW') {
    
    configurazione.compatibilitaAlimentazioneDimmer['ON-OFF'].push('TOUCH_SU_PROFILO');
    configurazione.compatibilitaAlimentazioneDimmer['DIMMERABILE_TRIAC'].push('TOUCH_SU_PROFILO');
  }
  checkStep4Completion();
}

export function caricaPotenzeAlimentatore(alimentatoreId) {
  $('#potenza-alimentatore-container').html('<div class="col-12 text-center"><div class="spinner-border" role="status"></div><p class="mt-3">Caricamento potenze disponibili...</p></div>');
  $('#potenza-alimentatore-section').show();
  
  configurazione.potenzaAlimentatoreSelezionata = null;
  $('#btn-continua-step4').prop('disabled', true);
  
  $.ajax({
    url: `/get_potenze_alimentatore/${alimentatoreId}`,
    method: 'GET',
    success: function(data) {
      $('#potenza-alimentatore-container').empty();
      
      if (!data.success) {
        $('#potenza-alimentatore-container').html('<div class="col-12 text-center"><p class="text-danger">Errore nel caricamento delle potenze disponibili.</p></div>');
        return;
      }
      
      const potenze = data.potenze;
      
      if (!potenze || potenze.length === 0) {
        $('#potenza-alimentatore-container').html('<div class="col-12 text-center"><p>Nessuna potenza disponibile per questo alimentatore.</p></div>');
        return;
      }

      const potenzaConsigliata = configurazione.potenzaConsigliataAlimentatore ? parseInt(configurazione.potenzaConsigliataAlimentatore) : 0;
      const potenzeOrdinate = [...potenze].sort((a, b) => a - b);

      let potenzaConsigliataProssima = null;
      if (potenzaConsigliata > 0) {
        potenzaConsigliataProssima = potenzeOrdinate.find(p => p >= potenzaConsigliata);
      }

      const potenzeAdeguate = potenzaConsigliata 
        ? potenzeOrdinate.filter(p => p >= potenzaConsigliata) 
        : potenzeOrdinate;
      
      potenzeAdeguate.forEach(function(potenza) {
        const isConsigliata = potenza === potenzaConsigliata;
        const isProssimaConsigliata = potenza === potenzaConsigliataProssima && potenza !== potenzaConsigliata;

        let badgeText = '';
        if (isConsigliata) {
          badgeText = '<span class="badge bg-success ms-2">Consigliata</span>';
        } else if (isProssimaConsigliata) {
          badgeText = '<span class="badge bg-success ms-2">Potenza consigliata</span>';
        }

        $('#potenza-alimentatore-container').append(`
          <div class="col-md-3 mb-3">
            <div class="card option-card potenza-alimentatore-card" data-potenza="${potenza}">
              <div class="card-body text-center">
                <h5 class="card-title">${potenza}W ${badgeText}</h5>
              </div>
            </div>
          </div>
        `);
      });

      const potenzeMostrate = $('.potenza-alimentatore-card');
      if (potenzeMostrate.length === 1) {
        const $unicaPotenza = $(potenzeMostrate[0]);
        $unicaPotenza.addClass('selected');
        configurazione.potenzaAlimentatoreSelezionata = $unicaPotenza.data('potenza');
        $('#btn-continua-step4').prop('disabled', false);
      } else {
        configurazione.potenzaAlimentatoreSelezionata = null;
        $('#btn-continua-step4').prop('disabled', true);

        if (potenzaConsigliata) {
          $('#potenza-alimentatore-info')
            .html(`<p>In base alla tua configurazione, la potenza consigliata è di <strong>${potenzaConsigliata}W</strong>, ma puoi selezionare la potenza che preferisci tra quelle disponibili.</p>`)
            .show();
        }
      }
    },
    error: function(error) {
      console.error("Errore nel caricamento delle potenze disponibili:", error);
      $('#potenza-alimentatore-container').html('<div class="col-12 text-center"><p class="text-danger">Errore nel caricamento delle potenze disponibili. Riprova più tardi.</p></div>');
    }
  });
}

export function checkStep4Completion() {
  let isComplete = true;
  
  if (!configurazione.alimentazioneSelezionata) {
    isComplete = false;
  }
  
  if (configurazione.alimentazioneSelezionata !== 'SENZA_ALIMENTATORE') {
    if (!configurazione.tipologiaAlimentatoreSelezionata) {
      isComplete = false;
    }
    
    if (!configurazione.potenzaAlimentatoreSelezionata) {
      isComplete = false;
    }
  }
  
  $('#btn-continua-step4').prop('disabled', !isComplete);
  return isComplete;
}