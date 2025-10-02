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
    $.ajax({
      url: '/get_opzioni_potenza_standalone',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        tipologia: configurazione.tipologiaStripSelezionata,
        tensione: configurazione.tensioneSelezionato,
        ip: configurazione.ipSelezionato,
        temperatura: configurazione.temperaturaSelezionata,
        special: configurazione.specialStripSelezionata
      }),
      success: function(data) {
        if (data.success) {
          renderizzaOpzioniPotenza(data.potenze);
        }
      }
    });
  } else {
    caricaOpzioniPotenza(configurazione.profiloSelezionato, configurazione.temperaturaSelezionata);
  }

  selezionaStripLedAutomaticamente();

  if (!configurazione.temperaturaSelezionata && configurazione.temperaturaColoreSelezionata) {
    configurazione.temperaturaSelezionata = configurazione.temperaturaColoreSelezionata;
  }
  
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
}

export function renderizzaOpzioniPotenza(potenze) {
  $('#potenza-container').empty();

  const potenzeOrdinate = [...potenze].sort((a, b) => {
    const potenzaA = (a.id || a.nome || a).toString();
    const potenzaB = (b.id || b.nome || b).toString();
    
    const numA = parseInt(potenzaA.match(/\d+/)[0]);
    const numB = parseInt(potenzaB.match(/\d+/)[0]);
    
    return numA - numB;
  });
  
  potenzeOrdinate.forEach(function(potenza) {
    $('#potenza-container').append(`
      <div class="col-md-4 mb-3">
        <div class="card option-card potenza-card" data-potenza="${potenza.id || potenza}">
          <div class="card-body">
            <h5 class="card-title">${potenza.nome || potenza}</h5>
          </div>
        </div>
      </div>
    `);
  });

  if (potenzeOrdinate.length === 1) {
    setTimeout(() => {
      $('.potenza-card').addClass('selected');
      configurazione.potenzaSelezionata = potenzeOrdinate[0].id || potenzeOrdinate[0];
      $('#strip-led-model-section').show();
      
      if (configurazione.isFlussoProfiliEsterni) {
        caricaStripLedFiltrate();
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
    }, 100);
  }
}

function caricaStripLedFiltrate() {
  $('#strip-led-compatibili-container').empty().html('<div class="text-center"><div class="spinner-border" role="status"></div><p class="mt-3">Caricamento strip LED...</p></div>');
  
  const requestData = {
    tipologia: configurazione.tipologiaStripSelezionata,
    special: configurazione.specialStripSelezionata,
    tensione: configurazione.tensioneSelezionato,
    ip: configurazione.ipSelezionato,
    temperatura: configurazione.temperaturaSelezionata,
    potenza: configurazione.potenzaSelezionata
  };
  
  $.ajax({
    url: '/get_strip_led_filtrate_standalone',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify(requestData),
    success: function(data) {      
      if (data.success && data.strip_led) {
        let stripHtml = '<div class="row">';
        
        data.strip_led.forEach(function(strip) {
          const nomeVisualizzato = strip.nomeCommerciale || strip.nome;
          const imgPath = `/static/img/strip/${strip.id}.jpg`;
          
          stripHtml += `
            <div class="col-md-4 mb-3">
              <div class="card option-card strip-led-compatibile-card" 
                  data-strip-id="${strip.id}" 
                  data-nome-commerciale="${strip.nomeCommerciale || ''}">
                <img src="${imgPath}" class="card-img-top" alt="${nomeVisualizzato}" 
                    style="height: 180px; object-fit: cover;" 
                    onerror="this.src='/static/img/placeholder_logo.jpg'; this.style.height='180px';">
                <div class="card-body">
                  <h5 class="card-title">${nomeVisualizzato}</h5>
                  <p class="card-text small">
                    Tensione: ${strip.tensione}, IP: ${strip.ip}, Temperatura: ${strip.temperatura}
                  </p>
                  <p class="card-text small">Potenza: ${configurazione.potenzaSelezionata}</p>
                </div>
              </div>
            </div>
          `;
        });
        
        stripHtml += '</div>';
        $('#strip-led-compatibili-container').html(stripHtml);

        if (data.strip_led.length === 1) {
          setTimeout(() => {
            $('.strip-led-compatibile-card').addClass('selected');
            const stripSelezionata = data.strip_led[0];
            configurazione.stripLedSceltaFinale = stripSelezionata.id;
            configurazione.nomeCommercialeStripLed = stripSelezionata.nomeCommerciale || '';
            configurazione.stripLedSelezionata = stripSelezionata.id;

            // Check if double strip is available
            verificaDoppiaStrip(stripSelezionata.id);
          }, 100);
        }
      } else {
        console.error("❌ Errore nella risposta o nessuna strip trovata:", data);
        $('#strip-led-compatibili-container').html(
          '<div class="alert alert-warning">Nessuna strip LED trovata per questa configurazione. Controlla i parametri selezionati.</div>'
        );
      }
    },
    error: function(xhr, status, error) {
      console.error("❌ ERRORE AJAX:", {
        status: xhr.status,
        statusText: xhr.statusText,
        responseText: xhr.responseText,
        error: error
      });
      
      $('#strip-led-compatibili-container').html(
        '<div class="alert alert-danger">Errore nel caricamento delle strip LED. Riprova più tardi.</div>'
      );
    },
  });
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

    if (configurazione.isFlussoProfiliEsterni) {
      caricaStripLedFiltrate();
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

    $('#strip-led-model-section').show();
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

    // Check if double strip is available for this profile and strip
    verificaDoppiaStrip(stripId);
  });

  $(document).off('click', '.doppia-strip-card').on('click', '.doppia-strip-card', function() {
    $('.doppia-strip-card').removeClass('selected');
    $(this).addClass('selected');

    const scelta = $(this).data('scelta');
    configurazione.doppiaStripSelezionata = (scelta === 'si');
    configurazione.moltiplicatoreStrip = (scelta === 'si') ? 2 : 1;

    $('#btn-continua-step3').prop('disabled', false);
  });
}

export function verificaDoppiaStrip(stripId) {
  console.log('[DEBUG DOPPIA STRIP] verificaDoppiaStrip chiamata con stripId:', stripId);
  console.log('[DEBUG DOPPIA STRIP] profiloSelezionato:', configurazione.profiloSelezionato);

  if (!configurazione.profiloSelezionato || !stripId) {
    console.log('[DEBUG DOPPIA STRIP] Missing profilo or strip, hiding section');
    $('#doppia-strip-section').hide();
    $('#btn-continua-step3').prop('disabled', false);
    return;
  }

  console.log('[DEBUG DOPPIA STRIP] Chiamando endpoint con:', {
    profilo_id: configurazione.profiloSelezionato,
    strip_id: stripId
  });

  $.ajax({
    url: '/verifica_doppia_strip',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({
      profilo_id: configurazione.profiloSelezionato,
      strip_id: stripId
    }),
    success: function(response) {
      console.log('[DEBUG DOPPIA STRIP] Response ricevuta:', response);

      if (response.success && response.can_double) {
        console.log('[DEBUG DOPPIA STRIP] Can double = TRUE, mostrando sezione');
        // Reset selection
        $('.doppia-strip-card').removeClass('selected');
        configurazione.doppiaStripSelezionata = false;
        configurazione.moltiplicatoreStrip = 1;

        // Show section
        $('#doppia-strip-section').fadeIn(300);
        $('#btn-continua-step3').prop('disabled', true);
      } else {
        console.log('[DEBUG DOPPIA STRIP] Can double = FALSE, nascondendo sezione');
        // Hide section and enable continue button
        $('#doppia-strip-section').hide();
        configurazione.doppiaStripSelezionata = false;
        configurazione.moltiplicatoreStrip = 1;
        $('#btn-continua-step3').prop('disabled', false);
      }
    },
    error: function(error) {
      console.error("[DEBUG DOPPIA STRIP] Errore verifica doppia strip:", error);
      $('#doppia-strip-section').hide();
      configurazione.doppiaStripSelezionata = false;
      configurazione.moltiplicatoreStrip = 1;
      $('#btn-continua-step3').prop('disabled', false);
    }
  });
}