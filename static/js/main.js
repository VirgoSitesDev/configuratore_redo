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

  $('a[href="javascript:location.reload(true)"]').on('click', function() {
    updateAlertDialogsVisibility(null);
  });
});