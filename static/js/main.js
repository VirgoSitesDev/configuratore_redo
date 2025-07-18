import { configurazione, mappaCategorieVisualizzazione } from './config.js';
import { updateProgressBar } from './utils.js';
import { initStep0Listeners } from './steps/step0.js';
import { initStep1Listeners } from './steps/step1.js';
import { initStep2Listeners } from './steps/step2.js';
import { initStep3Listeners, initPotenzaListener } from './steps/step3.js';
import { initStep4Listeners } from './steps/step4.js';
import { initStep5Listeners } from './steps/step5.js';
import { initStep6Listeners } from './steps/step6.js';
import { initStep7Listeners } from './steps/step7.js';
import { caricaProfili } from './api.js';
import { initStep2EsterniListeners } from './steps/step2_esterni.js';

$(document).ready(function() {
  $('<style>')
    .text(`
      .alert-dialog {
        display: none;
      }
      
      body.categoria-esterni .alert-dialog,
      body.categoria-wall_washer_ext .alert-dialog {
        display: block;
      }
    `)
    .appendTo('head');

  function updateAlertDialogsVisibility(categoria) {
    $('body').removeClass('categoria-esterni categoria-wall_washer_ext');
    if (categoria === 'esterni' || categoria === 'wall_washer_ext') {
      $('body').addClass(`categoria-${categoria}`);
    }
  }

  window.updateAlertDialogsVisibility = updateAlertDialogsVisibility;

  $(".step-section").hide();
  $("#step0-scelta-modalita").show();

  initStep0Listeners();
  initStep1Listeners();
  initStep2Listeners();
  initStep2EsterniListeners();
  initStep3Listeners();
  initPotenzaListener();
  initStep4Listeners();
  initStep5Listeners();
  initStep6Listeners();
  initStep7Listeners();

  updateProgressBar(0);

  let lastActivatedLight = null;

  function activateLight(categoria) {
    $('.svg-light').css('opacity', 0);
  
    if (categoria) {
      $(`.svg-light.${categoria}`).css('opacity', 1);
    }
  }

  $('.hotspot').on('mouseenter', function() {
    const categoria = $(this).data('categoria');
    if (categoria) {
      activateLight(categoria);
    }
  }).on('mouseleave', function() {
    if (!lastActivatedLight) {
      $('.svg-light').css('opacity', 0);
    } else {
      activateLight(lastActivatedLight);
    }
  });

  $('.hotspot').on('click', function() {
    const categoria = $(this).data('categoria');
    
    if (!categoria) {
      console.error("Nessuna categoria trovata per questo hotspot");
      return;
    }

    lastActivatedLight = categoria;

    configurazione.categoriaSelezionata = categoria;

    if (categoria === 'esterni' || categoria === 'wall_washer_ext') {
        configurazione.isFlussoProfiliEsterni = true;
        
        $('.categoria-selezionata').text(`Categoria: ${mappaCategorieVisualizzazione[categoria] || categoria}`);

        $("#step1-tipologia").fadeOut(300, function() {
            $("#step2-tipologia-strip").fadeIn(300);
            updateProgressBar(2);

            import('./steps/step2.js').then(module => {
                module.prepareTipologiaStripListeners();
            });
        });
    } else {
        configurazione.isFlussoProfiliEsterni = false;
        
        $('.categoria-selezionata').text(`Categoria: ${mappaCategorieVisualizzazione[categoria] || categoria}`);
        
        updateProgressBar(2);

        $("#step1-tipologia").fadeOut(300, function() {
            $("#step2-modello").fadeIn(300);
            caricaProfili(categoria);
        });
    }

    updateAlertDialogsVisibility(categoria);
});

  $('.btn-torna-indietro').on('click', function() {
    setTimeout(function() {
      if (lastActivatedLight) {
        activateLight(lastActivatedLight);
      }
    }, 400);
  });

  $('#btn-torna-step2-esterni').on('click', function(e) {
    e.preventDefault();
    $("#step2-modello-esterni").fadeOut(300, function() {
        $("#step3-temperatura-potenza").fadeIn(300);
    });
  });

$(document).on('click', '.alimentazione-card', function(e) {
  e.preventDefault();
  e.stopPropagation();
  
  const $card = $(this);

  if ($card.hasClass('selected')) {
      return;
  }
  
  $('.alimentazione-card').removeClass('selected');
  $card.addClass('selected');
  
  const alimentazione = $card.data('alimentazione');
  configurazione.alimentazioneSelezionata = alimentazione;
  
  if (alimentazione === 'SENZA_ALIMENTATORE') {
      $('#alimentatore-section').hide();
      $('#potenza-alimentatore-section').hide();
      configurazione.tipologiaAlimentatoreSelezionata = null;
      configurazione.potenzaAlimentatoreSelezionata = null;
      $('#btn-continua-step4').prop('disabled', false);
  } else {
      $('#alimentatore-section').show();
      $('#alimentatore-container').empty().html(
          '<div class="text-center"><div class="spinner-border" role="status"></div><p>Caricamento opzioni alimentatore...</p></div>'
      );
      
      const tensioneStrip = configurazione.tensioneSelezionato || '24V';
      const potenzaConsigliata = configurazione.potenzaConsigliataAlimentatore || 0;
      
      $.ajax({
          url: `/get_opzioni_alimentatore/${alimentazione}/${tensioneStrip}/${potenzaConsigliata}`,
          method: 'GET',
          success: function(data) {
              $('#alimentatore-container').empty();
              
              if (data.success && data.alimentatori && data.alimentatori.length > 0) {
                  data.alimentatori.forEach(function(alimentatore) {
                      $('#alimentatore-container').append(`
                          <div class="col-md-4 mb-3">
                              <div class="card option-card alimentatore-card" data-alimentatore="${alimentatore.id}">
                                  <div class="card-body">
                                      <h5 class="card-title">${alimentatore.nome}</h5>
                                      <p class="card-text small">${alimentatore.descrizione}</p>
                                  </div>
                              </div>
                          </div>
                      `);
                  });
              } else {
                  $('#alimentatore-container').html(
                      '<div class="col-12"><p class="text-danger">Nessun alimentatore disponibile per questa configurazione.</p></div>'
                  );
              }
          },
          error: function(error) {
              console.error("Errore nel caricamento degli alimentatori:", error);
              $('#alimentatore-container').html(
                  '<div class="col-12"><p class="text-danger">Errore nel caricamento degli alimentatori.</p></div>'
              );
          }
      });
  }
});

$(document).on('click', '.alimentatore-card', function(e) {
  e.preventDefault();
  e.stopPropagation();
  
  $('.alimentatore-card').removeClass('selected');
  $(this).addClass('selected');
  
  const alimentatoreId = $(this).data('alimentatore');
  configurazione.tipologiaAlimentatoreSelezionata = alimentatoreId;

  $('#potenza-alimentatore-section').show();
  $('#potenza-alimentatore-container').empty().html(
      '<div class="text-center"><div class="spinner-border" role="status"></div><p>Caricamento potenze...</p></div>'
  );

  if (configurazione.potenzaConsigliataAlimentatore > 0) {
      $('#potenza-alimentatore-info').show();
      $('#potenza-consigliata-text').text(configurazione.potenzaConsigliataAlimentatore);
  }
  
  $.ajax({
      url: `/get_potenze_alimentatore/${alimentatoreId}`,
      method: 'GET',
      success: function(data) {
          $('#potenza-alimentatore-container').empty();
          
          if (data.success && data.potenze && data.potenze.length > 0) {
              data.potenze.forEach(function(potenza) {
                  const isConsigliata = configurazione.potenzaConsigliataAlimentatore && 
                                      potenza >= configurazione.potenzaConsigliataAlimentatore;
                  
                  $('#potenza-alimentatore-container').append(`
                      <div class="col-md-3 mb-3">
                          <div class="card option-card potenza-alimentatore-card ${isConsigliata ? 'consigliata' : ''}" 
                               data-potenza="${potenza}">
                              <div class="card-body text-center">
                                  <h5 class="card-title">${potenza}W</h5>
                                  ${isConsigliata ? '<span class="badge bg-success">Consigliata</span>' : ''}
                              </div>
                          </div>
                      </div>
                  `);
              });
          } else {
              $('#potenza-alimentatore-container').html(
                  '<div class="col-12"><p class="text-danger">Nessuna potenza disponibile.</p></div>'
              );
          }
      },
      error: function(error) {
          console.error("Errore nel caricamento delle potenze:", error);
          $('#potenza-alimentatore-container').html(
              '<div class="col-12"><p class="text-danger">Errore nel caricamento delle potenze.</p></div>'
          );
      }
  });
});


$(document).on('click', '.potenza-alimentatore-card', function(e) {
  e.preventDefault();
  e.stopPropagation();
  
  $('.potenza-alimentatore-card').removeClass('selected');
  $(this).addClass('selected');
  
  configurazione.potenzaAlimentatoreSelezionata = $(this).data('potenza');
  $('#btn-continua-step4').prop('disabled', false);
});

  $('a[href="javascript:location.reload(true)"]').on('click', function() {
    updateAlertDialogsVisibility(null);
  });
});