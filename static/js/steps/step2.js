import { configurazione, mappaTipologieVisualizzazione, mappaTensioneVisualizzazione } from '../config.js';
import { updateProgressBar, checkPersonalizzazioneCompletion, formatTemperatura, checkParametriCompletion, getTemperaturaColor } from '../utils.js';
import { caricaFinitureDisponibili, finalizzaConfigurazione, caricaOpzioniIP } from '../api.js';
import { vaiAllaTemperaturaEPotenza } from './step3.js';

let isLoadingIP = false;
let isLoadingTemperatura = false;

export function initStep2Listeners() {
  $('#btn-continua-step2').on('click', function(e) {
    e.preventDefault();
    if (configurazione.profiloSelezionato && configurazione.tipologiaSelezionata) {
      vaiAllaPersonalizzazione();
    } else {
      let messaggi = [];
      if (!configurazione.profiloSelezionato) messaggi.push("un profilo");
      if (!configurazione.tipologiaSelezionata) messaggi.push("una tipologia");

      alert("Seleziona " + messaggi.join(", ") + " prima di continuare");
    }
  });

  $('#btn-torna-step2-modello').on('click', function(e) {
    e.preventDefault();
    
    $("#step2-personalizzazione").fadeOut(300, function() {
      if (configurazione.isFlussoProfiliEsterni) {
        $("#step2-modello-esterni").fadeIn(300);
      } else {
        $("#step2-modello").fadeIn(300);
      }
    });
  });

  $('#btn-continua-personalizzazione').on('click', function(e) {
    e.preventDefault();
    
    if (!checkPersonalizzazioneComplete()) {
        return;
    }
    if (configurazione.isFlussoProfiliEsterni) {
        saltaAlimentazionePerEsterni();
    } else {
        vaiAlleOpzioniStripLed();
    }
});

  $('#btn-torna-step2-personalizzazione').on('click', function(e) {
    e.preventDefault();
    
    $("#step2-option-strip").fadeOut(300, function() {
      $("#step2-personalizzazione").fadeIn(300);
    });
  });

  $('#btn-torna-step2-parametri').on('click', function(e) {
    e.preventDefault();

    isLoadingIP = false;
    isLoadingTemperatura = false;
    
    $("#step2-parametri").fadeOut(300, function() {
      $("#step2-tipologia-strip").fadeIn(300);
      updateProgressBar(configurazione.isFlussoProfiliEsterni ? 2 : 3);
    });
  });

  $('#btn-continua-parametri').on('click', function(e) {
    e.preventDefault();
    
    if (configurazione.tensioneSelezionato && configurazione.ipSelezionato && configurazione.temperaturaSelezionata) {
      vaiAllaTemperaturaEPotenza();
    } else {
      let messaggi = [];
      if (!configurazione.tensioneSelezionato) messaggi.push("una tensione");
      if (!configurazione.ipSelezionato) messaggi.push("un grado IP");
      if (!configurazione.temperaturaSelezionata) messaggi.push("una temperatura");
      
      alert("Seleziona " + messaggi.join(", ") + " prima di continuare");
    }
  });

  $('#btn-torna-step2-option-strip').on('click', function(e) {
    e.preventDefault();

    $("#step2-tipologia-strip").fadeOut(300, function() {
      if (configurazione.isFlussoProfiliEsterni) {
        // Clear strip selections when going back in outdoor flow
        configurazione.tipologiaStripSelezionata = null;
        configurazione.specialStripSelezionata = null;
        configurazione.categoriaSelezionata = null;

        // Remove selected classes from cards and reset visibility
        $('.tipologia-strip-card').removeClass('selected');
        $('.special-strip-card').removeClass('selected');
        $('.special-strip-card').parent().hide();
        $('#special-strip-container').hide();

        $("#step1-tipologia-outdoor").fadeIn(300);
        updateProgressBar(1);
      } else {
        $("#step2-option-strip").fadeIn(300);
        updateProgressBar(3);
      }
    });
  });

  $('#btn-continua-tipologia-strip').on('click', function(e) {
    e.preventDefault();
    
    if (!configurazione.tipologiaStripSelezionata) {
      alert("Seleziona una tipologia di strip LED prima di continuare");
      return;
    }

    if (configurazione.tipologiaStripSelezionata === 'SPECIAL' && !configurazione.specialStripSelezionata) {
      alert("Seleziona un tipo di special strip prima di continuare");
      return;
    }
    
    vaiAiParametriStripLed();
  });

  $(document).on('click', '.strip-option-card', function() {
    $('.strip-option-card').removeClass('selected');
    $(this).addClass('selected');
    
    const opzione = $(this).data('option');
    configurazione.includeStripLed = opzione === 'si';
    
    $('#btn-continua-step2-option').prop('disabled', false);
  });
  
$('#btn-continua-step2-option').on('click', function(e) {
  e.preventDefault();
  
  if (configurazione.includeStripLed === undefined) {
    alert("Seleziona se includere o meno una strip LED prima di continuare");
    return;
  }
  
  if (configurazione.includeStripLed) {
    vaiAllaTipologiaStrip();
  } else {
    configurazione.stripLedSelezionata = 'NO_STRIP';
    configurazione.alimentazioneSelezionata = 'SENZA_ALIMENTATORE';
    configurazione.tipologiaAlimentatoreSelezionata = null;
    configurazione.dimmerSelezionato = 'NESSUN_DIMMER';
    configurazione.tipoAlimentazioneCavo = 'ALIMENTAZIONE_UNICA';
    configurazione.lunghezzaCavoIngresso = 0;
    configurazione.lunghezzaCavoUscita = 0;
    configurazione.uscitaCavoSelezionata = 'DRITTA';

    updateProgressBar(6);
    
    $("#step2-option-strip").fadeOut(300, function() {
      finalizzaConfigurazione();
    });
  }
});
}

export function vaiAllaTipologiaStrip() {
  configurazione.tipologiaStripSelezionata = null;
  configurazione.specialStripSelezionata = null;

  if (configurazione.isFlussoProfiliEsterni) {
    $('#categoria-badge-strip').show();
    $('#categoria-nome-step2-tipologia-strip').text(
      mappaCategorieVisualizzazione[configurazione.categoriaSelezionata] || configurazione.categoriaSelezionata
    );
    $('#profilo-badge-strip').hide();
    $('#tipologia-badge-strip').hide();
    $('#sottotitolo-tipologia-strip').text('Configura prima la strip LED, poi sceglierai il profilo compatibile');
  } else {
    $('#categoria-badge-strip').hide();
    $('#profilo-badge-strip').show();
    $('#tipologia-badge-strip').show();
    $('#profilo-nome-step2-tipologia-strip').text(configurazione.nomeModello);
    $('#tipologia-nome-step2-tipologia-strip').text(
      mappaTipologieVisualizzazione[configurazione.tipologiaSelezionata] || configurazione.tipologiaSelezionata
    );
    $('#sottotitolo-tipologia-strip').text('Seleziona prima la tipologia di strip LED da utilizzare');
  }

  $('#special-strip-container').hide();
  
  $('.tipologia-strip-card').removeClass('selected');
  $('.special-strip-card').removeClass('selected');
  $('#btn-continua-tipologia-strip').prop('disabled', true);
  
  if (configurazione.isFlussoProfiliEsterni) {
    $("#step1-tipologia").fadeOut(300, function() {
      $("#step2-tipologia-strip").fadeIn(300);
      applicaFiltroTipologieEsterni();
    });
  } else {
    $("#step2-option-strip").fadeOut(300, function() {
      $("#step2-tipologia-strip").fadeIn(300);
      analizzaEMostraTipologieCompatibili();
    });
  }
}

function applicaFiltroTipologieEsterni() {
  $('.tipologia-strip-card').parent().hide();

  $('.tipologia-strip-card[data-tipologia-strip="SPECIAL"]').parent().show();

  setTimeout(() => {
    $('.tipologia-strip-card[data-tipologia-strip="SPECIAL"]').addClass('selected');
    configurazione.tipologiaStripSelezionata = 'SPECIAL';
    $('#special-strip-container').fadeIn(300);
    filtraSpecialStripPerEsterniFiltrate();
    $('#btn-continua-tipologia-strip').prop('disabled', true);

    prepareTipologiaStripListeners();
  }, 100);
}

function filtraSpecialStripPerEsterniFiltrate() {
  $('.special-strip-card').parent().hide();

  let specialStripEsterni = [];
  if (configurazione.categoriaSelezionata == 'esterni')
    specialStripEsterni = ['XSNAKE', 'XMAGIS'];
  else if (configurazione.categoriaSelezionata == 'wall_washer_ext')
    specialStripEsterni = ['XFLEX'];
  
  specialStripEsterni.forEach(specialType => {
    const $card = $(`.special-strip-card[data-special-strip="${specialType}"]`);
    if ($card.length > 0) {
      $card.parent().show();
    }
  });

  if (specialStripEsterni.length === 1) {
    const $unica = $(`.special-strip-card[data-special-strip="${specialStripEsterni[0]}"]`);
    setTimeout(() => {
      if ($unica.length > 0) {
        $unica.addClass('selected');
        configurazione.specialStripSelezionata = specialStripEsterni[0];
        $('#btn-continua-tipologia-strip').prop('disabled', false);
      }
    }, 100);
  }
}

function analizzaEMostraTipologieCompatibili() {
  if (configurazione.isFlussoProfiliEsterni) {
    applicaFiltroTipologieEsterni();
    return;
  }
  $('.tipologia-strip-card').parent().hide();
  $('#tipologia-strip-container').prepend(`
    <div id="tipologia-loading" class="text-center">
      <div class="spinner-border" role="status"></div>
      <p class="mt-3">Analisi tipologie compatibili...</p>
    </div>
  `);

  $.ajax({
    url: `/get_profili/${configurazione.categoriaSelezionata}`,
    method: 'GET',
    success: function(data) {
      $('#tipologia-loading').remove();

      const profiloSelezionato = data.find(p => p.id === configurazione.profiloSelezionato);
      
      if (!profiloSelezionato || !profiloSelezionato.stripLedCompatibili || profiloSelezionato.stripLedCompatibili.length === 0) {
        $('#tipologia-strip-container').html(`
          <div class="alert alert-warning">
            <p>Nessuna strip LED compatibile trovata per questo profilo.</p>
          </div>
        `);
        return;
      }

      let hasCOB = profiloSelezionato.stripLedCompatibili.some(id => id.includes('COB'));
      if (configurazione.lunghezzaRichiesta >= 10000)
      {
        hasCOB = profiloSelezionato.stripLedCompatibili.some(id => id.includes('220V'));
      }
      if (configurazione.lunghezzaRichiesta >= 50000)
      {
        hasCOB = false;
      }

      let hasSMD = profiloSelezionato.stripLedCompatibili.some(id => id.includes('SMD'));
      
      let hasSpecial = profiloSelezionato.stripLedCompatibili.some(id => 
        !id.includes('COB') && !id.includes('SMD') || 
        id.includes('ZIGZAG') || 
        id.includes('XFLEX') || 
        id.includes('XSNAKE') || 
        id.includes('XMAGIS'));
        
      if (configurazione.lunghezzaRichiesta >= 10000)
      {
        hasSMD = profiloSelezionato.stripLedCompatibili.some(id => id.includes('48V'));
        hasSpecial = profiloSelezionato.stripLedCompatibili.some(id => id.includes('48V'));
      }
      if (configurazione.lunghezzaRichiesta >= 30000)
      {
        hasSMD = false;
        hasSpecial = false;
      }

      if (hasCOB) {
        $('.tipologia-strip-card[data-tipologia-strip="COB"]').parent().show();
      }
      
      if (hasSMD) {
        $('.tipologia-strip-card[data-tipologia-strip="SMD"]').parent().show();
      }
      
      if (hasSpecial) {
        $('.tipologia-strip-card[data-tipologia-strip="SPECIAL"]').parent().show();
      }

      const tipologieVisibili = $('.tipologia-strip-card').parent(':visible').length;
      
      if (tipologieVisibili === 0) {
        $('#tipologia-strip-container').html(`
          <div class="alert alert-warning">
            <p>Nessuna strip LED compatibile trovata per questo profilo.</p>
          </div>
        `);
      } else if (tipologieVisibili === 1) {
        const $unica = $('.tipologia-strip-card').parent(':visible').find('.tipologia-strip-card');
        $unica.addClass('selected');
        configurazione.tipologiaStripSelezionata = $unica.data('tipologia-strip');

        if (configurazione.tipologiaStripSelezionata === 'SPECIAL') {
          $('#special-strip-container').fadeIn(300);
          filtraSpecialStripCompatibili(profiloSelezionato.stripLedCompatibili);
        } else {
          $('#btn-continua-tipologia-strip').prop('disabled', false);
        }
      }
      prepareTipologiaStripListeners();
    },
    error: function(error) {
      $('#tipologia-loading').remove();
      console.error("Errore nel caricamento delle strip compatibili:", error);
      $('#tipologia-strip-container').html(`
        <div class="alert alert-danger">
          <p>Errore nel caricamento delle strip LED compatibili. Riprova più tardi.</p>
        </div>
      `);
    }
  });
}

function filtraSpecialStripCompatibili(stripCompatibili) {
  $('.special-strip-card').parent().hide();

  const specialStripMap = {
    'XFLEX': ['XFLEX', 'FLEX'],
    'ZIG_ZAG': ['ZIGZAG', 'ZIG_ZAG', 'ZIG-ZAG'],
    'XSNAKE': ['XSNAKE', 'SNAKE'],
    'XMAGIS': ['XMAGIS', 'MAGIS']
  };

  for (const [specialType, keywords] of Object.entries(specialStripMap)) {
    const isCompatible = stripCompatibili.some(stripId => 
      keywords.some(keyword => stripId.toUpperCase().includes(keyword))
    );
    
    if (isCompatible) {
      $(`.special-strip-card[data-special-strip="${specialType}"]`).parent().show();
    }
  }

  const specialVisibili = $('.special-strip-card').parent(':visible').length;
  
  if (specialVisibili === 1) {
    const $unica = $('.special-strip-card').parent(':visible').find('.special-strip-card');
    $unica.addClass('selected');
    configurazione.specialStripSelezionata = $unica.data('special-strip');
    $('#btn-continua-tipologia-strip').prop('disabled', false);
  } else if (specialVisibili === 0) {
    $('#special-strip-container').html(`
      <h3 class="mb-3">Tipo di Special Strip</h3>
      <div class="alert alert-warning">
        <p>Nessuna special strip compatibile trovata per questo profilo.</p>
      </div>
    `);
    $('.tipologia-strip-card').removeClass('selected');
    configurazione.tipologiaStripSelezionata = null;
    $('#btn-continua-tipologia-strip').prop('disabled', true);
  }
}

export function prepareTipologiaStripListeners() {
  if (configurazione.isFlussoProfiliEsterni && !$('.tipologia-strip-card[data-tipologia-strip="SPECIAL"]').hasClass('selected')) {
    applicaFiltroTipologieEsterni();
    return;
  }

  $('.tipologia-strip-card').off('click').on('click', function() {
    $('.tipologia-strip-card').removeClass('selected');
    $(this).addClass('selected');
    
    const tipologiaStrip = $(this).data('tipologia-strip');
    configurazione.tipologiaStripSelezionata = tipologiaStrip;

    if (tipologiaStrip !== 'SPECIAL') {
      configurazione.specialStripSelezionata = null;
      $('#special-strip-container').hide();

      $('#btn-continua-tipologia-strip').prop('disabled', false);
    } else {
      $('#special-strip-container').fadeIn(300);
      $('#btn-continua-tipologia-strip').prop('disabled', true);

      if (!configurazione.isFlussoProfiliEsterni) {
        $.ajax({
          url: `/get_profili/${configurazione.categoriaSelezionata}`,
          method: 'GET',
          success: function(data) {
            const profiloSelezionato = data.find(p => p.id === configurazione.profiloSelezionato);
            if (profiloSelezionato && profiloSelezionato.stripLedCompatibili) {
              filtraSpecialStripCompatibili(profiloSelezionato.stripLedCompatibili);
            }
          },
          error: function(error) {
            console.error("Errore nel caricamento delle strip compatibili:", error);
          }
        });
      } else {
        filtraSpecialStripPerEsterniFiltrate();
      }
    }
  });
  
  $('.special-strip-card').off('click').on('click', function() {
    $('.special-strip-card').removeClass('selected');
    $(this).addClass('selected');
    
    configurazione.specialStripSelezionata = $(this).data('special-strip');
    $('#btn-continua-tipologia-strip').prop('disabled', false);
  });
}

export function vaiAllaPersonalizzazione() {
    $('#profilo-nome-step2-personalizzazione').text(configurazione.nomeModello);
    $('#tipologia-nome-step2-personalizzazione').text(mappaTipologieVisualizzazione[configurazione.tipologiaSelezionata] || configurazione.tipologiaSelezionata);

    let fromStep = "#step2-modello";
    if (configurazione.isFlussoProfiliEsterni) {
      fromStep = "#step2-modello-esterni";
    }

    $(fromStep).fadeOut(300, function() {
      $("#step2-personalizzazione").fadeIn(300);
      
      preparePersonalizzazioneListeners();

    if (configurazione.tipologiaSelezionata === 'profilo_intero' && configurazione.lunghezzaRichiesta) {
      $('#lunghezza-info-container').remove();
      
      const lunghezzaMetri = configurazione.lunghezzaSelezionata ? configurazione.lunghezzaSelezionata : configurazione.lunghezzaRichiesta;
      const infoMessage = `
        <div class="container mb-5" id="lunghezza-info-container">
          <h3 class="mb-3">Lunghezza profilo</h3>
          <div class="alert alert-info">
            <p>Hai selezionato un profilo intero con una lunghezza di ${lunghezzaMetri}mm.</p>
          </div>
        </div>
      `;
      
      $('#finitura-container').closest('.container').after(infoMessage);
    }
  });
}

export function preparePersonalizzazioneListeners() {
  // Load finiture with length filter ONLY for profilo_intero (standard length)
  // For taglio_misura (custom length), show all finiture (no length filter)
  let lunghezzaPerFiltro = null;
  if (configurazione.tipologiaSelezionata === 'profilo_intero') {
    lunghezzaPerFiltro = configurazione.lunghezzaRichiesta || configurazione.lunghezzaSelezionata || configurazione.lunghezzaProfiloIntero;
  }
  caricaFinitureDisponibili(configurazione.profiloSelezionato, lunghezzaPerFiltro);

  // For OUTDOOR flow: fetch strip data to get giuntabile and lunghezzaMassima
  if (configurazione.categoriaSelezionata === 'esterni' || configurazione.categoriaSelezionata === 'wall_washer_ext') {
    $.ajax({
      url: '/get_strip_led_filtrate_standalone',
      method: 'POST',
      contentType: 'application/json',
      async: false,
      data: JSON.stringify({
        tipologia: configurazione.tipologiaStripSelezionata,
        special: configurazione.specialStripSelezionata,
        tensione: configurazione.tensioneSelezionato,
        ip: configurazione.ipSelezionato,
        temperatura: configurazione.temperaturaSelezionata,
        potenza: configurazione.potenzaSelezionata
      }),
      success: function(data) {
        if (data.success && data.strip_led && data.strip_led.length > 0) {
          const strip = data.strip_led[0];
          configurazione.stripLedSelezionata = strip.id;
          configurazione.stripLedSceltaFinale = strip.id;
          configurazione.nomeCommercialeStripLed = strip.nomeCommerciale || '';
          configurazione.lunghezzaMassimaStripLed = strip.lunghezzaMassima || 5000;
          configurazione.stripGiuntabile = strip.giuntabile !== undefined ? strip.giuntabile : true;
        }
      }
    });

    $('.forma-taglio-card').parent().hide();
    $('.forma-taglio-card[data-forma="DRITTO_SEMPLICE"]').parent().show();
    $('.forma-taglio-card[data-forma="DRITTO_SEMPLICE"]').addClass('selected');
    configurazione.formaDiTaglioSelezionata = 'DRITTO_SEMPLICE';

    updateIstruzioniMisurazione('DRITTO_SEMPLICE');
    
    $('.forma-taglio-card').off('click');
    $('#forma-taglio-note').remove();

    $('#forma-taglio-container').after(`
      <div id="forma-taglio-note" class="row">
        <div class="col-12">
          <div class="alert alert-warning mt-3 mb-3">
            <strong>Nota:</strong> Per i profili di questa categoria è disponibile solo il taglio dritto semplice.
          </div>
        </div>
      </div>
    `);
  } else {
    $('.forma-taglio-card').parent().show();
    $('#forma-taglio-note').remove();
    
    $('.forma-taglio-card').on('click', function() {
      $('.forma-taglio-card').removeClass('selected');
      $(this).addClass('selected');
      
      configurazione.formaDiTaglioSelezionata = $(this).data('forma');
      
      updateIstruzioniMisurazione(configurazione.formaDiTaglioSelezionata);
      checkPersonalizzazioneCompletion();
    });
  }

  $('.finitura-card').on('click', function() {
    $('.finitura-card').removeClass('selected');
    $(this).addClass('selected');
    
    configurazione.finituraSelezionata = $(this).data('finitura');

    checkPersonalizzazioneCompletion();
  });

  $('#lunghezza-personalizzata').on('input', function() {
    configurazione.lunghezzaRichiesta = parseInt($(this).val(), 10) || null;
    if (configurazione.diffusoreSelezionato) {
      calcolaQuantitaDiffusore();
    }
    checkPersonalizzazioneCompletion();
  });

  if (configurazione.tipologiaSelezionata === 'profilo_intero') {
    configurazione.formaDiTaglioSelezionata = 'DRITTO_SEMPLICE';

    if (configurazione.lunghezzaMassimaProfilo) {
      configurazione.lunghezzaRichiesta = configurazione.lunghezzaMassimaProfilo;
    }
  } else {
    $('.forma-taglio-card').on('click', function() {
      $('.forma-taglio-card').removeClass('selected');
      $(this).addClass('selected');
      
      configurazione.formaDiTaglioSelezionata = $(this).data('forma');
      
      updateIstruzioniMisurazione(configurazione.formaDiTaglioSelezionata);
      checkPersonalizzazioneCompletion();
    });
  }

  toggleFormaTaglioSection();
  togglePersonalizzazioneLunghezza();
  checkPersonalizzazioneCompletion();
  verificaEMostraTappi();

  // Verifica diffusori solo per indoor (non esterni)
  if (!configurazione.isFlussoProfiliEsterni) {
    verificaEMostraDiffusori();
  }

  // Verifica staffe sia per indoor che outdoor
  verificaEMostraStaffe();
}

async function verificaEMostraTappi() {
  if (!configurazione.profiloSelezionato) {
    console.log('[DEBUG TAPPI] Nessun profilo selezionato');
    return;
  }

  console.log('[DEBUG TAPPI] Verificando tappi per profilo:', configurazione.profiloSelezionato);
  console.log('[DEBUG TAPPI] isFlussoProfiliEsterni:', configurazione.isFlussoProfiliEsterni);

  try {
    // Verifica se esistono tappi per questo profilo
    const response = await $.ajax({
      url: '/verifica_tappi_profilo',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        profilo_id: configurazione.profiloSelezionato
      })
    });

    console.log('[DEBUG TAPPI] Response:', response);

    if (response.success && response.has_tappi) {
      mostraSezioneConfigurazioneTappi(response.tappi_disponibili);
    } else {
      // Nascondi la sezione tappi se non ci sono tappi disponibili
      $('#tappi-container').remove();
      configurazione.tappiSelezionati = null;
      configurazione.quantitaTappi = null;
      // Restore original length if it was modified
      if (configurazione.lunghezzaOriginalePreTappi !== undefined) {
        configurazione.lunghezzaRichiesta = configurazione.lunghezzaOriginalePreTappi;
        configurazione.lunghezzaEffettivaProfilo = configurazione.lunghezzaOriginalePreTappi;
      }
    }
  } catch (error) {
    console.error("Errore verifica tappi:", error);
    $('#tappi-container').remove();
  }
}

function mostraSezioneConfigurazioneTappi(tappiDisponibili) {
  // Rimuovi sezione esistente se presente
  $('#tappi-container').remove();

  // Trova il punto di inserimento
  let insertAfter;
  if (configurazione.tipologiaSelezionata === 'profilo_intero') {
    insertAfter = $('#lunghezza-info-container');
  } else {
    insertAfter = $('.container.mb-5:has(h3:contains("Personalizzazione lunghezza"))');
  }

  if (insertAfter.length === 0) {
    console.error("Non riesco a trovare il punto di inserimento per i tappi");
    return;
  }

  // Check if any tappo has inclusi=true
  const tappoIncluso = tappiDisponibili.find(tappo => tappo.inclusi === true);

  if (tappoIncluso) {
    // Only show note for custom length (taglio_misura), not for standard length (profilo_intero)
    if (configurazione.tipologiaSelezionata === 'taglio_misura') {
      // Show note about automatic inclusion with calculation
      const lunghezzaSelezionata = configurazione.lunghezzaRichiesta || 0;
      // Cap effective quantity to 2 for included caps
      const effectiveQty = Math.min(tappoIncluso.quantita || 1, 2);
      const lunghezzaEsternatappi = (tappoIncluso.lunghezza_esterna || 0) * effectiveQty;
      const lunghezzaRisultante = lunghezzaSelezionata - lunghezzaEsternatappi;

      const tappiHtml = `
        <div class="container mb-5" id="tappi-container">
          <h3 class="mb-3">Configurazione Tappi</h3>
          <div class="alert alert-info" id="tappi-inclusi-note">
            <p>Per questo profilo i tappi verranno inclusi in automatico e la lunghezza risultante del profilo sarà <strong><span id="lunghezza-risultante-tappi">${lunghezzaRisultante}</span>mm</strong> (<span id="lunghezza-input-tappi">${lunghezzaSelezionata}</span>mm - ${lunghezzaEsternatappi}mm dei tappi)</p>
          </div>
        </div>
      `;

      insertAfter.after(tappiHtml);

      // Update the note when user changes the length input
      $('#lunghezza-personalizzata').off('input.tappi').on('input.tappi', function() {
        const nuovaLunghezza = parseInt($(this).val(), 10) || 0;
        const nuovaLunghezzaRisultante = nuovaLunghezza - lunghezzaEsternatappi;
        $('#lunghezza-input-tappi').text(nuovaLunghezza);
        $('#lunghezza-risultante-tappi').text(nuovaLunghezzaRisultante);
        configurazione.lunghezzaEffettivaProfilo = nuovaLunghezzaRisultante;
      });

      configurazione.lunghezzaEffettivaProfilo = lunghezzaRisultante;
    }

    // Store included tappo info without adding to quote
    configurazione.tappiSelezionati = tappoIncluso;
    configurazione.tappiInclusi = true;
    configurazione.quantitaTappi = 0; // Not counted in quote

    return;
  }

  // Filter tappi by finish
  const finituraMapping = {
    'NERO': 'NERO',
    'BIANCO': 'BIANCO',
    'ALLUMINIO': ['ALLUMINIO', 'GRIGIO'],
    'ALLUMINIO_ANODIZZATO': ['ALLUMINIO', 'GRIGIO']
  };

  const finituraRichiesta = configurazione.finituraSelezionata;
  const finitureCompatibili = Array.isArray(finituraMapping[finituraRichiesta])
    ? finituraMapping[finituraRichiesta]
    : [finituraMapping[finituraRichiesta]];

  let tappiFiltrati = tappiDisponibili.filter(tappo =>
    finitureCompatibili.includes(tappo.finitura)
  );

  if (tappiFiltrati.length === 0) {
    console.log('[DEBUG TAPPI] Nessun tappo trovato per finitura, usando tutti i tappi disponibili');
    tappiFiltrati = tappiDisponibili;
  }

  // Check availability of both types
  const haForati = tappiFiltrati.some(t => t.forati === true);
  const haCiechi = tappiFiltrati.some(t => t.forati === false);

  const tappiHtml = `
    <div class="container mb-5" id="tappi-container">
      <h3 class="mb-3">Configurazione Tappi</h3>

      <div class="mb-4">
        <h5 class="mb-3">Vuoi aggiungere i tappi al profilo?</h5>
        <div class="row" id="tappi-scelta-container">
          <div class="col-md-6 mb-3">
            <div class="card option-card tappi-scelta-card" data-scelta="si">
              <div class="card-body text-center">
                <h5 class="card-title">Sì</h5>
                <p class="card-text small text-muted">Aggiungi tappi al profilo</p>
              </div>
            </div>
          </div>
          <div class="col-md-6 mb-3">
            <div class="card option-card tappi-scelta-card" data-scelta="no">
              <div class="card-body text-center">
                <h5 class="card-title">No</h5>
                <p class="card-text small text-muted">Procedi senza tappi</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="tappi-dettagli-section" style="display: none;">
        ${haCiechi ? `
        <!-- Tappi Ciechi Section -->
        <div class="mb-5" id="tappi-ciechi-section">
          <div class="mb-4">
            <h5 class="mb-3">Vuoi inserire dei tappi ciechi?</h5>
            <div class="row" id="tappi-ciechi-scelta-container">
              <div class="col-md-6 mb-3">
                <div class="card option-card tappi-ciechi-scelta-card" data-scelta="si">
                  <div class="card-body text-center">
                    <h5 class="card-title">Sì</h5>
                    <p class="card-text small text-muted">Aggiungi tappi ciechi</p>
                  </div>
                </div>
              </div>
              <div class="col-md-6 mb-3">
                <div class="card option-card tappi-ciechi-scelta-card" data-scelta="no">
                  <div class="card-body text-center">
                    <h5 class="card-title">No</h5>
                    <p class="card-text small text-muted">Nessun tappo cieco</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div id="tappi-ciechi-quantita-section" style="display: none;">
            <div class="alert alert-info mb-3">
              <p class="mb-0"><strong>Tappo selezionato:</strong> Tappi ciechi</p>
              <p class="mb-0"><strong>Codice:</strong> <span id="tappo-cieco-codice"></span></p>
            </div>

            <div class="mb-4">
              <h5 class="mb-3">Quantità tappi ciechi</h5>
              <div class="row">
                <div class="col-md-6">
                  <label for="quantita-tappi-ciechi" class="form-label">Quantità (multipli di <span id="tappo-cieco-quantita-minima"></span>):</label>
                  <input type="number" class="form-control" id="quantita-tappi-ciechi"
                         min="0" step="1" value="0">
                  <small class="text-muted">La quantità deve essere un multiplo di <span id="tappo-cieco-quantita-minima-text"></span></small>
                </div>
              </div>
            </div>
          </div>
        </div>
        ` : ''}

        ${haForati ? `
        <!-- Tappi Forati Section -->
        <div class="mb-5" id="tappi-forati-section">
          <div class="mb-4">
            <h5 class="mb-3">Vuoi inserire dei tappi forati?</h5>
            <div class="row" id="tappi-forati-scelta-container">
              <div class="col-md-6 mb-3">
                <div class="card option-card tappi-forati-scelta-card" data-scelta="si">
                  <div class="card-body text-center">
                    <h5 class="card-title">Sì</h5>
                    <p class="card-text small text-muted">Aggiungi tappi forati</p>
                  </div>
                </div>
              </div>
              <div class="col-md-6 mb-3">
                <div class="card option-card tappi-forati-scelta-card" data-scelta="no">
                  <div class="card-body text-center">
                    <h5 class="card-title">No</h5>
                    <p class="card-text small text-muted">Nessun tappo forato</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div id="tappi-forati-quantita-section" style="display: none;">
            <div class="alert alert-info mb-3">
              <p class="mb-0"><strong>Tappo selezionato:</strong> Tappi forati</p>
              <p class="mb-0"><strong>Codice:</strong> <span id="tappo-forato-codice"></span></p>
            </div>

            <div class="mb-4">
              <h5 class="mb-3">Quantità tappi forati</h5>
              <div class="row">
                <div class="col-md-6">
                  <label for="quantita-tappi-forati" class="form-label">Quantità (multipli di <span id="tappo-forato-quantita-minima"></span>):</label>
                  <input type="number" class="form-control" id="quantita-tappi-forati"
                         min="0" step="1" value="0">
                  <small class="text-muted">La quantità deve essere un multiplo di <span id="tappo-forato-quantita-minima-text"></span></small>
                </div>
              </div>
            </div>
          </div>
        </div>
        ` : ''}

        <div class="alert alert-warning" id="tappi-lunghezza-warning" style="display: none;">
          <strong>ATTENZIONE:</strong> La lunghezza effettiva del profilo sarà
          <strong><span id="lunghezza-effettiva-profilo"></span>mm</strong>
          (lunghezza selezionata - <span id="lunghezza-esterna-tappi"></span>mm dei tappi)
        </div>
      </div>
    </div>
  `;

  insertAfter.after(tappiHtml);

  // Salva i dati dei tappi disponibili
  window.tappiDisponibili = tappiFiltrati;
  configurazione.tappiInclusi = false;

  // Event listeners per scelta principale Sì/No
  $('.tappi-scelta-card').on('click', function() {
    $('.tappi-scelta-card').removeClass('selected');
    $(this).addClass('selected');

    const scelta = $(this).data('scelta');

    if (scelta === 'si') {
      $('#tappi-dettagli-section').slideDown(300);
      // Auto-select if only one type available
      if (haCiechi && !haForati) {
        setTimeout(() => {
          $('.tappi-ciechi-scelta-card[data-scelta="si"]').trigger('click');
        }, 100);
      } else if (!haCiechi && haForati) {
        setTimeout(() => {
          $('.tappi-forati-scelta-card[data-scelta="si"]').trigger('click');
        }, 100);
      }
    } else {
      $('#tappi-dettagli-section').slideUp(300);
      // Reset all tappi configurations
      configurazione.tappiCiechiSelezionati = null;
      configurazione.quantitaTappiCiechi = null;
      configurazione.tappiForatiSelezionati = null;
      configurazione.quantitaTappiForati = null;
      configurazione.tappiSelezionati = null;
      configurazione.quantitaTappi = null;
      // Restore original length if it was modified
      if (configurazione.lunghezzaOriginalePreTappi !== undefined) {
        configurazione.lunghezzaRichiesta = configurazione.lunghezzaOriginalePreTappi;
        configurazione.lunghezzaEffettivaProfilo = configurazione.lunghezzaOriginalePreTappi;
      }
      checkPersonalizzazioneCompletion();
    }
  });

  // Event listeners for Tappi Ciechi
  if (haCiechi) {
    $('.tappi-ciechi-scelta-card').on('click', function() {
      $('.tappi-ciechi-scelta-card').removeClass('selected');
      $(this).addClass('selected');

      const scelta = $(this).data('scelta');

      if (scelta === 'si') {
        selezionaTappoCiecoAutomatico(tappiFiltrati);
        $('#tappi-ciechi-quantita-section').slideDown(300);
      } else {
        $('#tappi-ciechi-quantita-section').slideUp(300);
        configurazione.tappiCiechiSelezionati = null;
        configurazione.quantitaTappiCiechi = null;
        aggiornaLunghezzaEffettiva();
        checkPersonalizzazioneCompletion();
      }
    });

    $('#quantita-tappi-ciechi').on('input change', function() {
      aggiornaQuantitaTappiCiechi();
    });
  }

  // Event listeners for Tappi Forati
  if (haForati) {
    $('.tappi-forati-scelta-card').on('click', function() {
      $('.tappi-forati-scelta-card').removeClass('selected');
      $(this).addClass('selected');

      const scelta = $(this).data('scelta');

      if (scelta === 'si') {
        selezionaTappoForatoAutomatico(tappiFiltrati);
        $('#tappi-forati-quantita-section').slideDown(300);
      } else {
        $('#tappi-forati-quantita-section').slideUp(300);
        configurazione.tappiForatiSelezionati = null;
        configurazione.quantitaTappiForati = null;
        aggiornaLunghezzaEffettiva();
        checkPersonalizzazioneCompletion();
      }
    });

    $('#quantita-tappi-forati').on('input change', function() {
      aggiornaQuantitaTappiForati();
    });
  }
}

function selezionaTappoCiecoAutomatico(tappiDisponibili) {
  if (!tappiDisponibili || tappiDisponibili.length === 0) {
    return;
  }

  // Trova il tappo cieco compatibile
  let tappoCompatibile = tappiDisponibili.find(tappo => tappo.forati === false);

  if (tappoCompatibile) {
    configurazione.tappiCiechiSelezionati = tappoCompatibile;

    // Aggiorna UI
    $('#tappo-cieco-codice').text(tappoCompatibile.codice);
    $('#tappo-cieco-quantita-minima').text(tappoCompatibile.quantita);
    $('#tappo-cieco-quantita-minima-text').text(tappoCompatibile.quantita);

    // Imposta quantità di default
    $('#quantita-tappi-ciechi').attr('min', tappoCompatibile.quantita);
    $('#quantita-tappi-ciechi').attr('step', tappoCompatibile.quantita);
    $('#quantita-tappi-ciechi').val(tappoCompatibile.quantita);

    configurazione.quantitaTappiCiechi = tappoCompatibile.quantita;

    aggiornaLunghezzaEffettiva();
    checkPersonalizzazioneCompletion();
  } else {
    console.error("Nessun tappo cieco compatibile trovato");
    $('#tappi-ciechi-quantita-section').html(`
      <div class="alert alert-danger">
        <strong>Errore:</strong> Nessun tappo cieco disponibile.
      </div>
    `);
  }
}

function selezionaTappoForatoAutomatico(tappiDisponibili) {
  if (!tappiDisponibili || tappiDisponibili.length === 0) {
    return;
  }

  // Trova il tappo forato compatibile
  let tappoCompatibile = tappiDisponibili.find(tappo => tappo.forati === true);

  if (tappoCompatibile) {
    configurazione.tappiForatiSelezionati = tappoCompatibile;

    // Aggiorna UI
    $('#tappo-forato-codice').text(tappoCompatibile.codice);
    $('#tappo-forato-quantita-minima').text(tappoCompatibile.quantita);
    $('#tappo-forato-quantita-minima-text').text(tappoCompatibile.quantita);

    // Imposta quantità di default
    $('#quantita-tappi-forati').attr('min', tappoCompatibile.quantita);
    $('#quantita-tappi-forati').attr('step', tappoCompatibile.quantita);
    $('#quantita-tappi-forati').val(tappoCompatibile.quantita);

    configurazione.quantitaTappiForati = tappoCompatibile.quantita;

    aggiornaLunghezzaEffettiva();
    checkPersonalizzazioneCompletion();
  } else {
    console.error("Nessun tappo forato compatibile trovato");
    $('#tappi-forati-quantita-section').html(`
      <div class="alert alert-danger">
        <strong>Errore:</strong> Nessun tappo forato disponibile.
      </div>
    `);
  }
}

function aggiornaQuantitaTappiCiechi() {
  const tappo = configurazione.tappiCiechiSelezionati;
  if (!tappo) return;

  const quantitaInserita = parseInt($('#quantita-tappi-ciechi').val()) || 0;
  const quantitaMinima = tappo.quantita;

  // Verifica che sia un multiplo della quantità minima
  if (quantitaInserita < quantitaMinima) {
    $('#quantita-tappi-ciechi').val(quantitaMinima);
    configurazione.quantitaTappiCiechi = quantitaMinima;
  } else if (quantitaInserita % quantitaMinima !== 0) {
    // Arrotonda al multiplo più vicino
    const multiplo = Math.round(quantitaInserita / quantitaMinima) * quantitaMinima;
    $('#quantita-tappi-ciechi').val(multiplo);
    configurazione.quantitaTappiCiechi = multiplo;
  } else {
    configurazione.quantitaTappiCiechi = quantitaInserita;
  }

  aggiornaLunghezzaEffettiva();
  checkPersonalizzazioneCompletion();
}

function aggiornaQuantitaTappiForati() {
  const tappo = configurazione.tappiForatiSelezionati;
  if (!tappo) return;

  const quantitaInserita = parseInt($('#quantita-tappi-forati').val()) || 0;
  const quantitaMinima = tappo.quantita;

  // Verifica che sia un multiplo della quantità minima
  if (quantitaInserita < quantitaMinima) {
    $('#quantita-tappi-forati').val(quantitaMinima);
    configurazione.quantitaTappiForati = quantitaMinima;
  } else if (quantitaInserita % quantitaMinima !== 0) {
    // Arrotonda al multiplo più vicino
    const multiplo = Math.round(quantitaInserita / quantitaMinima) * quantitaMinima;
    $('#quantita-tappi-forati').val(multiplo);
    configurazione.quantitaTappiForati = multiplo;
  } else {
    configurazione.quantitaTappiForati = quantitaInserita;
  }

  aggiornaLunghezzaEffettiva();
  checkPersonalizzazioneCompletion();
}

function aggiornaLunghezzaEffettiva() {
  // Store original length if not already stored
  if (configurazione.lunghezzaOriginalePreTappi === undefined && configurazione.lunghezzaRichiesta) {
    configurazione.lunghezzaOriginalePreTappi = configurazione.lunghezzaRichiesta;
  }

  const tappoCieco = configurazione.tappiCiechiSelezionati;
  const tappoForato = configurazione.tappiForatiSelezionati;

  // Check if any tappi are selected
  if ((!tappoCieco || !configurazione.quantitaTappiCiechi) &&
      (!tappoForato || !configurazione.quantitaTappiForati)) {
    // No tappi selected, restore original length
    if (configurazione.lunghezzaOriginalePreTappi !== undefined) {
      configurazione.lunghezzaRichiesta = configurazione.lunghezzaOriginalePreTappi;
      configurazione.lunghezzaEffettivaProfilo = configurazione.lunghezzaOriginalePreTappi;
    }
    $('#tappi-lunghezza-warning').hide();
    return;
  }

  if (!configurazione.lunghezzaOriginalePreTappi) return;

  if (configurazione.tipologiaSelezionata === 'taglio_misura') {
    const lunghezzaOriginale = configurazione.lunghezzaOriginalePreTappi;

    // Calculate combined external length from both tappi types
    let lunghezzaEsternatappiTotale = 0;

    // Add length from tappi ciechi
    if (tappoCieco && configurazione.quantitaTappiCiechi) {
      const effectiveQtyCiechi = Math.min(configurazione.quantitaTappiCiechi, 2);
      lunghezzaEsternatappiTotale += (tappoCieco.lunghezza_esterna || 0) * effectiveQtyCiechi;
    }

    // Add length from tappi forati
    if (tappoForato && configurazione.quantitaTappiForati) {
      const effectiveQtyForati = Math.min(configurazione.quantitaTappiForati, 2);
      lunghezzaEsternatappiTotale += (tappoForato.lunghezza_esterna || 0) * effectiveQtyForati;
    }

    // Cap total effective quantity at 2 if both types are selected
    if (tappoCieco && tappoForato && configurazione.quantitaTappiCiechi && configurazione.quantitaTappiForati) {
      const qtyCiechi = Math.min(configurazione.quantitaTappiCiechi, 2);
      const qtyForati = Math.min(configurazione.quantitaTappiForati, 2);
      const totalQty = qtyCiechi + qtyForati;

      if (totalQty > 2) {
        // Recalculate proportionally
        const lunghezzaCiechi = (tappoCieco.lunghezza_esterna || 0) * qtyCiechi;
        const lunghezzaForati = (tappoForato.lunghezza_esterna || 0) * qtyForati;
        lunghezzaEsternatappiTotale = Math.min(lunghezzaCiechi + lunghezzaForati,
          (tappoCieco.lunghezza_esterna || 0) * 2);
      }
    }

    const lunghezzaEffettiva = lunghezzaOriginale - lunghezzaEsternatappiTotale;

    $('#lunghezza-esterna-tappi').text(lunghezzaEsternatappiTotale);
    $('#lunghezza-effettiva-profilo').text(lunghezzaEffettiva);

    // Override lunghezzaRichiesta with effective length
    configurazione.lunghezzaRichiesta = lunghezzaEffettiva;
    configurazione.lunghezzaEffettivaProfilo = lunghezzaEffettiva;

    $('#tappi-lunghezza-warning').show();
  } else {
    $('#tappi-lunghezza-warning').hide();
    // Keep original length for profilo_intero
    configurazione.lunghezzaRichiesta = configurazione.lunghezzaOriginalePreTappi;
    configurazione.lunghezzaEffettivaProfilo = configurazione.lunghezzaOriginalePreTappi;
  }
}

// ==================== DIFFUSORI FUNCTIONS ====================

async function verificaEMostraDiffusori() {
  if (!configurazione.profiloSelezionato) {
    return;
  }

  try {
    const response = await $.ajax({
      url: '/verifica_diffusori_profilo',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        profilo_id: configurazione.profiloSelezionato
      })
    });

    if (response.success && response.has_diffusore) {
      mostraSezioneConfigurazioneDiffusore(response.diffusore);
    } else {
      $('#diffusore-container').remove();
      configurazione.diffusoreSelezionato = null;
      configurazione.quantitaDiffusore = null;
    }
  } catch (error) {
    console.error("Errore verifica diffusore:", error);
    $('#diffusore-container').remove();
  }
}

function mostraSezioneConfigurazioneDiffusore(diffusore) {
  $('#diffusore-container').remove();

  // Insert after tappi-container or lunghezza-info-container
  let insertAfter = $('#tappi-container');
  if (insertAfter.length === 0) {
    if (configurazione.tipologiaSelezionata === 'profilo_intero') {
      insertAfter = $('#lunghezza-info-container');
    } else {
      insertAfter = $('.container.mb-5:has(h3:contains("Personalizzazione lunghezza"))');
    }
  }

  if (insertAfter.length === 0) {
    console.error("Non riesco a trovare il punto di inserimento per il diffusore");
    return;
  }

  const diffusoreHtml = `
    <div class="container mb-5" id="diffusore-container">
      <h3 class="mb-3">Configurazione Diffusore</h3>

      <div class="mb-4">
        <h5 class="mb-3">Vuoi aggiungere il diffusore al profilo?</h5>
        <div class="row" id="diffusore-scelta-container">
          <div class="col-md-6 mb-3">
            <div class="card option-card diffusore-scelta-card" data-scelta="si">
              <div class="card-body text-center">
                <h5 class="card-title">Sì</h5>
                <p class="card-text small text-muted">Aggiungi diffusore al profilo</p>
              </div>
            </div>
          </div>
          <div class="col-md-6 mb-3">
            <div class="card option-card diffusore-scelta-card" data-scelta="no">
              <div class="card-body text-center">
                <h5 class="card-title">No</h5>
                <p class="card-text small text-muted">Procedi senza diffusore</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="diffusore-dettagli-section" style="display: none;">
        <div class="alert alert-info mb-3">
          <p class="mb-0"><strong>Diffusore selezionato:</strong> ${diffusore.codice}</p>
          <p class="mb-0"><strong>Lunghezza diffusore:</strong> ${diffusore.lunghezza}mm</p>
          <p class="mb-0"><strong>Quantità calcolata:</strong> <span id="quantita-diffusore-calcolata">0</span> pezzi</p>
        </div>
      </div>
    </div>
  `;

  insertAfter.after(diffusoreHtml);

  window.diffusoreData = diffusore;

  $('.diffusore-scelta-card').on('click', function() {
    $('.diffusore-scelta-card').removeClass('selected');
    $(this).addClass('selected');

    const scelta = $(this).data('scelta');

    if (scelta === 'si') {
      $('#diffusore-dettagli-section').slideDown(300);
      calcolaQuantitaDiffusore();
    } else {
      $('#diffusore-dettagli-section').slideUp(300);
      configurazione.diffusoreSelezionato = null;
      configurazione.quantitaDiffusore = null;
      checkPersonalizzazioneCompletion();
    }
  });
}

function calcolaQuantitaDiffusore() {
  if (!window.diffusoreData || !configurazione.lunghezzaRichiesta) {
    return;
  }

  const lunghezzaDiffusore = window.diffusoreData.lunghezza;
  const lunghezzaProfilo = configurazione.lunghezzaRichiesta;

  const quantita = Math.ceil(lunghezzaProfilo / lunghezzaDiffusore);

  $('#quantita-diffusore-calcolata').text(quantita);

  configurazione.diffusoreSelezionato = window.diffusoreData;
  configurazione.quantitaDiffusore = quantita;

  checkPersonalizzazioneCompletion();
}

// ==================== STAFFE FUNCTIONS ====================

async function verificaEMostraStaffe() {
  if (!configurazione.profiloSelezionato) {
    console.log('[DEBUG STAFFE] Nessun profilo selezionato');
    return;
  }

  console.log('[DEBUG STAFFE] Verificando staffe per profilo:', configurazione.profiloSelezionato);
  console.log('[DEBUG STAFFE] isFlussoProfiliEsterni:', configurazione.isFlussoProfiliEsterni);

  try {
    const response = await $.ajax({
      url: '/verifica_staffe_profilo',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        profilo_id: configurazione.profiloSelezionato
      })
    });

    console.log('[DEBUG STAFFE] Response:', response);

    if (response.success && response.has_staffa) {
      mostraSezioneConfigurazioneStaffe(response.staffa);
    } else {
      $('#staffe-container').remove();
      configurazione.staffaSelezionata = null;
    }
  } catch (error) {
    console.error("Errore verifica staffe:", error);
    $('#staffe-container').remove();
  }
}

function mostraSezioneConfigurazioneStaffe(staffa) {
  $('#staffe-container').remove();

  // Insert after diffusore-container or tappi-container or lunghezza-info-container
  let insertAfter = $('#diffusore-container');
  if (insertAfter.length === 0) {
    insertAfter = $('#tappi-container');
  }
  if (insertAfter.length === 0) {
    if (configurazione.tipologiaSelezionata === 'profilo_intero') {
      insertAfter = $('#lunghezza-info-container');
    } else {
      insertAfter = $('.container.mb-5:has(h3:contains("Personalizzazione lunghezza"))');
    }
  }

  if (insertAfter.length === 0) {
    console.error("Non riesco a trovare il punto di inserimento per le staffe");
    return;
  }

  const staffeHtml = `
    <div class="container mb-5" id="staffe-container">
      <h3 class="mb-3">Staffe di fissaggio</h3>

      <div class="mb-4">
        <h5 class="mb-3">Vuoi aggiungere le staffe di fissaggio?</h5>
        <div class="row" id="staffe-scelta-container">
          <div class="col-md-6 mb-3">
            <div class="card option-card staffe-scelta-card" data-scelta="si">
              <div class="card-body text-center">
                <h5 class="card-title">Sì</h5>
                <p class="card-text small text-muted">Aggiungi staffe di fissaggio</p>
              </div>
            </div>
          </div>
          <div class="col-md-6 mb-3">
            <div class="card option-card staffe-scelta-card" data-scelta="no">
              <div class="card-body text-center">
                <h5 class="card-title">No</h5>
                <p class="card-text small text-muted">Procedi senza staffe</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="staffe-dettagli-section" style="display: none;">
        <div class="alert alert-info mb-3">
          <p class="mb-0"><strong>Staffa selezionata:</strong> ${staffa.codice}</p>
        </div>

        <div class="mb-4">
          <h5 class="mb-3">Quantità staffe</h5>
          <div class="row">
            <div class="col-md-6">
              <label for="quantita-staffe" class="form-label">Quantità:</label>
              <input type="number" class="form-control" id="quantita-staffe"
                     min="1" step="1" value="1">
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  insertAfter.after(staffeHtml);

  window.staffaData = staffa;

  $('.staffe-scelta-card').on('click', function() {
    $('.staffe-scelta-card').removeClass('selected');
    $(this).addClass('selected');

    const scelta = $(this).data('scelta');

    if (scelta === 'si') {
      $('#staffe-dettagli-section').slideDown(300);
      configurazione.staffaSelezionata = window.staffaData;

      // Set initial quantity to 1
      configurazione.quantitaStaffe = 1;
      $('#quantita-staffe').val(1);

      checkPersonalizzazioneCompletion();
    } else {
      $('#staffe-dettagli-section').slideUp(300);
      configurazione.staffaSelezionata = null;
      configurazione.quantitaStaffe = null;
      checkPersonalizzazioneCompletion();
    }
  });

  // Add event handler for quantity changes
  $('#quantita-staffe').on('input change', function() {
    const quantita = parseInt($(this).val()) || 1;

    // Ensure minimum is 1
    if (quantita < 1) {
      $(this).val(1);
      configurazione.quantitaStaffe = 1;
    } else {
      configurazione.quantitaStaffe = quantita;
    }

    checkPersonalizzazioneCompletion();
  });
}

function toggleFormaTaglioSection() {
  let formaTaglioContainer = null;
  $('.container.mb-5').each(function() {
    const heading = $(this).find('h3.mb-1').text();
    if (heading === 'Forma di taglio') {
      formaTaglioContainer = $(this);
    }
  });
  
  if (!formaTaglioContainer) {
    console.error("Impossibile trovare la sezione di forma di taglio");
    return;
  }
  
  if (configurazione.tipologiaSelezionata === 'profilo_intero') {
    formaTaglioContainer.hide();

    configurazione.formaDiTaglioSelezionata = 'DRITTO_SEMPLICE';

    $('.forma-taglio-card[data-forma="DRITTO_SEMPLICE"]').addClass('selected');
  } else {
    formaTaglioContainer.show();
  }
}

function togglePersonalizzazioneLunghezza() {
  $('#lunghezza-info-container').remove();

  let personalizzazioneLunghezzaContainer = null;
  $('.container.mb-5').each(function() {
    const heading = $(this).find('h3.mb-3').text();
    if (heading === 'Personalizzazione lunghezza') {
      personalizzazioneLunghezzaContainer = $(this);
    }
  });
  
  if (!personalizzazioneLunghezzaContainer) {
    console.error("Impossibile trovare la sezione di personalizzazione lunghezza");
    return;
  }
  
  if (configurazione.tipologiaSelezionata === 'profilo_intero') {
    personalizzazioneLunghezzaContainer.hide();

    const lunghezzaMassima = configurazione.lunghezzaRichiesta || configurazione.lunghezzaMassimaProfilo || 3000;
    const lunghezzaMetri = lunghezzaMassima / 1000;
    const infoMessage = `
      <div class="container mb-5" id="lunghezza-info-container">
        <h3 class="mb-3">Lunghezza profilo</h3>
        <div class="alert alert-info">
          <p>Hai selezionato un profilo intero che ha una lunghezza di ${lunghezzaMetri}m (${lunghezzaMassima}mm).</p>
        </div>
      </div>
    `;

    $('#finitura-container').closest('.container').after(infoMessage);

    if (configurazione.isFlussoProfiliEsterni && !configurazione.tipologiaSelezionata) {
      configurazione.tipologiaSelezionata = 'taglio_misura';
    }

    if (!configurazione.lunghezzaRichiesta && lunghezzaMassima) {
      configurazione.lunghezzaRichiesta = lunghezzaMassima;
      configurazione.lunghezzaProfiloIntero = lunghezzaMassima;
      configurazione.lunghezzaSelezionata = lunghezzaMassima;
    }
    setTimeout(checkPersonalizzazioneCompletion, 100);
  } else {
    personalizzazioneLunghezzaContainer.show();
  }
}

export function updateIstruzioniMisurazione(forma) {
  if (configurazione.tipologiaSelezionata === 'profilo_intero') {
    return;
  }
  
  const istruzioniContainer = $('#istruzioni-misurazione');
  const misurazioneContainer = $('#misurazione-container');
  
  istruzioniContainer.empty();
  misurazioneContainer.empty();

  $('.lunghezza-personalizzata-container').remove();
  configurazione.lunghezzeMultiple = {};
  
  switch(forma) {
    case 'DRITTO_SEMPLICE':
      istruzioniContainer.html(`
        <p>Inserisci la lunghezza desiderata in millimetri.</p>
        <img src="/static/img/dritto_semplice.png" alt="Forma dritta" class="img-fluid mb-3"
             style="width: 100%; max-width: 300px;">
      `);

      // Check if strip is giuntabile to set max length (only for outdoor and solo_strip flows)
      const isOutdoorOrSoloStrip = configurazione.modalitaConfigurazione === 'solo_strip' ||
                                    configurazione.categoriaSelezionata === 'esterni' ||
                                    configurazione.categoriaSelezionata === 'wall_washer_ext';
      const maxAttr = (isOutdoorOrSoloStrip && configurazione.stripGiuntabile === false && configurazione.lunghezzaMassimaStripLed)
        ? `max="${configurazione.lunghezzaMassimaStripLed}"`
        : '';

      misurazioneContainer.html(`
        <div class="form-group mb-4 lunghezza-personalizzata-container">
          <label for="lunghezza-personalizzata">Lunghezza richiesta (mm):</label>
          <input type="number" class="form-control" id="lunghezza-personalizzata"
                 placeholder="Inserisci la lunghezza in millimetri" min="100" ${maxAttr}>
          <p class="assembly-warning mt-2">NOTA: la lunghezza massima per strip 24V è 10mt, per le strip 48V è 30mt mentre per le strip 220v è 50mt</p>
        </div>
      `);

      $('#lunghezza-personalizzata').on('input', function() {
        let lunghezza = parseInt($(this).val(), 10) || null;

        // For OUTDOOR/ONLY_LED: validate against strip max length if not giuntabile
        const isOutdoorOrSoloStrip = configurazione.modalitaConfigurazione === 'solo_strip' ||
                                      configurazione.categoriaSelezionata === 'esterni' ||
                                      configurazione.categoriaSelezionata === 'wall_washer_ext';

        if (isOutdoorOrSoloStrip && configurazione.stripGiuntabile === false && configurazione.lunghezzaMassimaStripLed && lunghezza) {
          if (lunghezza > configurazione.lunghezzaMassimaStripLed) {
            alert(`ATTENZIONE: La lunghezza massima per questa strip LED è ${configurazione.lunghezzaMassimaStripLed}mm (${configurazione.lunghezzaMassimaStripLed/1000}m). La strip non è giuntabile.`);
            $(this).val(configurazione.lunghezzaMassimaStripLed);
            lunghezza = configurazione.lunghezzaMassimaStripLed;
          }
        }

        configurazione.lunghezzaRichiesta = lunghezza;
        configurazione.lunghezzaMassimaLato = lunghezza;  // For single length, max side = total length
        if (configurazione.diffusoreSelezionato) {
          calcolaQuantitaDiffusore();
        }
        checkPersonalizzazioneCompletion();
      });
      $('#non-assemblato-warning').hide();
      break;
      
    case 'FORMA_L_DX':
      istruzioniContainer.html(`
        <p>Inserisci le lunghezze per entrambi i lati del profilo a L.</p>
        <img src="/static/img/forma_a_l_dx.png" alt="Forma a L destra" class="img-fluid mb-3"
             style="width: 100%; max-width: 300px;">
      `);

      const isOutdoorOrSoloStripLDx = configurazione.modalitaConfigurazione === 'solo_strip' ||
                                       configurazione.categoriaSelezionata === 'esterni' ||
                                       configurazione.categoriaSelezionata === 'wall_washer_ext';
      const maxAttrLDx = (isOutdoorOrSoloStripLDx && configurazione.stripGiuntabile === false && configurazione.lunghezzaMassimaStripLed)
        ? `max="${configurazione.lunghezzaMassimaStripLed}"`
        : '';

      misurazioneContainer.html(`
        <div class="form-group mb-3 lunghezza-personalizzata-container">
          <label for="lunghezza-lato1">Lunghezza lato orizzontale (mm):</label>
          <input type="number" class="form-control campo-lunghezza-multipla" id="lunghezza-lato1"
                 data-lato="lato1" placeholder="Lato orizzontale" min="100" ${maxAttrLDx}>
        </div>
        <div class="form-group mb-4 lunghezza-personalizzata-container">
          <label for="lunghezza-lato2">Lunghezza lato verticale (mm):</label>
          <input type="number" class="form-control campo-lunghezza-multipla" id="lunghezza-lato2"
                 data-lato="lato2" placeholder="Lato verticale" min="100" ${maxAttrLDx}>
        </div>
      `);
      mostraNonAssemblatoWarning();
      break;
      
    case 'FORMA_L_SX':
      istruzioniContainer.html(`
        <p>Inserisci le lunghezze per entrambi i lati del profilo a L.</p>
        <img src="/static/img/forma_a_l_sx.png" alt="Forma a L sinistra" class="img-fluid mb-3"
             style="width: 100%; max-width: 300px;">
      `);

      const isOutdoorOrSoloStripLSx = configurazione.modalitaConfigurazione === 'solo_strip' ||
                                       configurazione.categoriaSelezionata === 'esterni' ||
                                       configurazione.categoriaSelezionata === 'wall_washer_ext';
      const maxAttrLSx = (isOutdoorOrSoloStripLSx && configurazione.stripGiuntabile === false && configurazione.lunghezzaMassimaStripLed)
        ? `max="${configurazione.lunghezzaMassimaStripLed}"`
        : '';

      misurazioneContainer.html(`
        <div class="form-group mb-3 lunghezza-personalizzata-container">
          <label for="lunghezza-lato1">Lunghezza lato orizzontale (mm):</label>
          <input type="number" class="form-control campo-lunghezza-multipla" id="lunghezza-lato1"
                 data-lato="lato1" placeholder="Lato orizzontale" min="100" ${maxAttrLSx}>
        </div>
        <div class="form-group mb-4 lunghezza-personalizzata-container">
          <label for="lunghezza-lato2">Lunghezza lato verticale (mm):</label>
          <input type="number" class="form-control campo-lunghezza-multipla" id="lunghezza-lato2"
                 data-lato="lato2" placeholder="Lato verticale" min="100" ${maxAttrLSx}>
        </div>
      `);
      mostraNonAssemblatoWarning();
      break;
      
    case 'FORMA_C':
      istruzioniContainer.html(`
        <p>Inserisci le lunghezze per tutti i lati del profilo a C.</p>
        <img src="/static/img/forma_a_c.png" alt="Forma a C" class="img-fluid mb-3"
             style="width: 100%; max-width: 300px;">
      `);

      const isOutdoorOrSoloStripC = configurazione.modalitaConfigurazione === 'solo_strip' ||
                                     configurazione.categoriaSelezionata === 'esterni' ||
                                     configurazione.categoriaSelezionata === 'wall_washer_ext';
      const maxAttrC = (isOutdoorOrSoloStripC && configurazione.stripGiuntabile === false && configurazione.lunghezzaMassimaStripLed)
        ? `max="${configurazione.lunghezzaMassimaStripLed}"`
        : '';

      misurazioneContainer.html(`
        <div class="form-group mb-3 lunghezza-personalizzata-container">
          <label for="lunghezza-lato1">Lunghezza lato orizzontale superiore (mm):</label>
          <input type="number" class="form-control campo-lunghezza-multipla" id="lunghezza-lato1"
                 data-lato="lato1" placeholder="Lato orizzontale superiore" min="100" ${maxAttrC}>
        </div>
        <div class="form-group mb-3 lunghezza-personalizzata-container">
          <label for="lunghezza-lato2">Lunghezza lato verticale (mm):</label>
          <input type="number" class="form-control campo-lunghezza-multipla" id="lunghezza-lato2"
                 data-lato="lato2" placeholder="Lato verticale" min="100" ${maxAttrC}>
        </div>
        <div class="form-group mb-4 lunghezza-personalizzata-container">
          <label for="lunghezza-lato3">Lunghezza lato orizzontale inferiore (mm):</label>
          <input type="number" class="form-control campo-lunghezza-multipla" id="lunghezza-lato3"
                 data-lato="lato3" placeholder="Lato orizzontale inferiore" min="100" ${maxAttrC}>
        </div>
      `);
      mostraNonAssemblatoWarning();
      break;
      
    case 'RETTANGOLO_QUADRATO':
      istruzioniContainer.html(`
        <p>Inserisci le lunghezze per i lati del rettangolo/quadrato.</p>
        <img src="/static/img/forma_a_rettangolo.png" alt="Forma rettangolare" class="img-fluid mb-3"
             style="width: 100%; max-width: 300px;">
      `);

      const isOutdoorOrSoloStripRect = configurazione.modalitaConfigurazione === 'solo_strip' ||
                                        configurazione.categoriaSelezionata === 'esterni' ||
                                        configurazione.categoriaSelezionata === 'wall_washer_ext';
      const maxAttrRect = (isOutdoorOrSoloStripRect && configurazione.stripGiuntabile === false && configurazione.lunghezzaMassimaStripLed)
        ? `max="${configurazione.lunghezzaMassimaStripLed}"`
        : '';

      misurazioneContainer.html(`
        <div class="form-group mb-3 lunghezza-personalizzata-container">
          <label for="lunghezza-lato1">Lunghezza (mm):</label>
          <input type="number" class="form-control campo-lunghezza-multipla" id="lunghezza-lato1"
                 data-lato="lato1" placeholder="Lunghezza" min="100" ${maxAttrRect}>
        </div>
        <div class="form-group mb-4 lunghezza-personalizzata-container">
          <label for="lunghezza-lato2">Larghezza (mm):</label>
          <input type="number" class="form-control campo-lunghezza-multipla" id="lunghezza-lato2"
                 data-lato="lato2" placeholder="Larghezza" min="100" ${maxAttrRect}>
        </div>
      `);
      mostraNonAssemblatoWarning();
      break;
      
    default:
      istruzioniContainer.html(`<p>Seleziona una forma di taglio per visualizzare le istruzioni.</p>`);
  }

  $('.campo-lunghezza-multipla').on('input', function() {
    const lato = $(this).data('lato');
    let valore = parseInt($(this).val(), 10) || null;

    // For OUTDOOR/ONLY_LED: validate EACH INDIVIDUAL SIDE against strip max length if not giuntabile
    // Each side must fit within the strip's standard length
    const isOutdoorOrSoloStrip = configurazione.modalitaConfigurazione === 'solo_strip' ||
                                  configurazione.categoriaSelezionata === 'esterni' ||
                                  configurazione.categoriaSelezionata === 'wall_washer_ext';

    if (isOutdoorOrSoloStrip && configurazione.stripGiuntabile === false && configurazione.lunghezzaMassimaStripLed && valore) {
      if (valore > configurazione.lunghezzaMassimaStripLed) {
        alert(`ATTENZIONE: Ogni singolo lato non può superare ${configurazione.lunghezzaMassimaStripLed}mm (${configurazione.lunghezzaMassimaStripLed/1000}m). La strip non è giuntabile.`);
        $(this).val(configurazione.lunghezzaMassimaStripLed);
        valore = configurazione.lunghezzaMassimaStripLed;
      }
    }

    if (!configurazione.lunghezzeMultiple) {
      configurazione.lunghezzeMultiple = {};
    }

    configurazione.lunghezzeMultiple[lato] = valore;

    let sommaLunghezze = 0;
    let tuttiValoriPresenti = true;
    let lunghezzaMassima = 0;

    Object.values(configurazione.lunghezzeMultiple).forEach(val => {
      if (val && val > 0) {
        sommaLunghezze += val;
        lunghezzaMassima = Math.max(lunghezzaMassima, val);
      } else {
        tuttiValoriPresenti = false;
      }
    });

    if (tuttiValoriPresenti) {
      configurazione.lunghezzaRichiesta = sommaLunghezze;
      configurazione.lunghezzaMassimaLato = lunghezzaMassima;  // Maximum individual side for giuntabile check
    } else {
      configurazione.lunghezzaRichiesta = null;
      configurazione.lunghezzaMassimaLato = null;
    }

    if (configurazione.diffusoreSelezionato) {
      calcolaQuantitaDiffusore();
    }

    checkPersonalizzazioneCompletion();
  });
}

function mostraNonAssemblatoWarning() {
  if ($('#non-assemblato-warning').length === 0) {
    const warningHtml = `
      <div id="non-assemblato-warning" class="assembly-warning mt-0 mb-4">
        <p>NOTA: la lunghezza massima per strip 24V è 10mt, per le strip 48V è 30mt mentre per le strip 220v è 50mt</p>
        <strong>IMPORTANTE:</strong> I profili verranno consegnati non assemblati tra di loro e la strip verrà consegnata non installata.
      </div>
    `;
    $('#misurazione-container').after(warningHtml);
  } else {
    $('#non-assemblato-warning').show();
  }
}

export function vaiAlleOpzioniStripLed() {
  $('#profilo-nome-step2-option').text(configurazione.nomeModello);
  $('#tipologia-nome-step2-option').text(mappaTipologieVisualizzazione[configurazione.tipologiaSelezionata] || configurazione.tipologiaSelezionata);
  
  $("#step2-personalizzazione").fadeOut(300, function() {
    $("#step2-option-strip").fadeIn(300);
    $('.strip-option-card').removeClass('selected');
    $('#btn-continua-step2-option').prop('disabled', true);
    configurazione.includeStripLed = undefined;
  });
}

export function vaiAiParametriStripLed() {
  isLoadingIP = false;
  isLoadingTemperatura = false;
  
  $('#profilo-nome-step2-parametri').text(configurazione.nomeModello);
  $('#tipologia-nome-step2-parametri').text(mappaTipologieVisualizzazione[configurazione.tipologiaSelezionata] || configurazione.tipologiaSelezionata);

  let tipologiaStripText = configurazione.tipologiaStripSelezionata;
  if (configurazione.tipologiaStripSelezionata === 'SPECIAL' && configurazione.specialStripSelezionata) {
    tipologiaStripText += ` - ${configurazione.specialStripSelezionata}`;
  }

  if ($('#tipologia-strip-nome-step2-parametri').length === 0) {
    $('.selection-badges').append(`
      <span class="badge bg-primary selection-badge">Tipologia Strip: <span id="tipologia-strip-nome-step2-parametri">${tipologiaStripText}</span></span>
    `);
  } else {
    $('#tipologia-strip-nome-step2-parametri').text(tipologiaStripText);
  }
  
  if (configurazione.isFlussoProfiliEsterni) {
    $('#profilo-nome-step2-parametri').parent().hide();
    $('#tipologia-nome-step2-parametri').parent().hide();
  }
  
  $("#step2-tipologia-strip").fadeOut(300, function() { 
    $("#step2-parametri").fadeIn(300);
    updateProgressBar(3);
    caricaOpzioniParametriFiltrate();
  });
}

export function caricaOpzioniParametriFiltrate() {
  isLoadingIP = false;
  isLoadingTemperatura = false;
  
  $('#tensione-options').empty().html('<div class="spinner-border" role="status"></div><p>Caricamento opzioni tensione...</p>');
  $('#ip-options').empty();
  $('#temperatura-iniziale-options').empty();
  
  configurazione.tensioneSelezionato = null;
  configurazione.ipSelezionato = null;
  configurazione.temperaturaSelezionata = null;
  
  $('#btn-continua-parametri').prop('disabled', true);
  
  if (configurazione.isFlussoProfiliEsterni) {
    $.ajax({
      url: '/get_opzioni_strip_standalone',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        tipologia: configurazione.tipologiaStripSelezionata,
        special: configurazione.specialStripSelezionata
      }),
      success: function(data) {
        if (data.success) {
          renderizzaOpzioniTensione(data.tensioni);
        } else {
          $('#tensione-options').html('<p class="text-danger">Errore nel caricamento delle opzioni tensione.</p>');
        }
      },
      error: function(error) {
        console.error("Errore nel caricamento delle opzioni tensione:", error);
        $('#tensione-options').html('<p class="text-danger">Errore nel caricamento delle opzioni tensione. Riprova più tardi.</p>');
      }
    });
  } else {
    let url = `/get_opzioni_tensione/${configurazione.profiloSelezionato}/${configurazione.tipologiaStripSelezionata}`;
    // For INDOOR flow, add max side length to filter by giuntabile (not total length)
    if (configurazione.lunghezzaMassimaLato) {
      url += `/${configurazione.lunghezzaMassimaLato}`;
    }

    // Add special subfamily as query parameter if SPECIAL tipo is selected
    if (configurazione.tipologiaStripSelezionata === 'SPECIAL' && configurazione.specialStripSelezionata) {
      url += `?special=${configurazione.specialStripSelezionata}`;
    }

    $.ajax({
      url: url,
      method: 'GET',
      success: function(data) {
        if (data.success && data.voltaggi) {
          let tensioniDisponibili = data.voltaggi;

          if (configurazione.lunghezzaRichiesta > 10000) {
            tensioniDisponibili = tensioniDisponibili.filter(tensione => tensione !== '24V');
          }
          if (configurazione.lunghezzaRichiesta > 30000) {
            tensioniDisponibili = tensioniDisponibili.filter(tensione => tensione !== '48V');
          }
          renderizzaOpzioniTensione(tensioniDisponibili);
        } else {
          $('#tensione-options').html('<p class="text-danger">Errore nel caricamento delle opzioni tensione.</p>');
        }
      },
      error: function(error) {
        console.error("Errore nel caricamento delle opzioni tensione:", error);
        $('#tensione-options').html('<p class="text-danger">Errore nel caricamento delle opzioni tensione. Riprova più tardi.</p>');
      }
    });
  }
}

function renderizzaOpzioniTensione(tensioni) {
  $('#tensione-options').empty();
  
  if (!tensioni || tensioni.length === 0) {
    $('#tensione-options').html('<p>Nessuna opzione di tensione disponibile per questa tipologia.</p>');
    return;
  }
  
  tensioni.sort((a, b) => {
    const voltA = parseInt(a.replace('V', ''));
    const voltB = parseInt(b.replace('V', ''));
    return voltA - voltB;  
  });

  tensioni.forEach(function(tensione) {
    $('#tensione-options').append(`
      <div class="col-md-4 mb-3">
        <div class="card option-card tensione-card" data-tensione="${tensione}">
          <div class="card-body text-center">
            <h5 class="card-title">${mappaTensioneVisualizzazione[tensione] || tensione}</h5>
          </div>
        </div>
      </div>
    `);
  });

  if (tensioni.length === 1) {
    setTimeout(function() {
      const $unicaTensione = $('.tensione-card');
      
      if ($unicaTensione.length > 0) {
        $unicaTensione.addClass('selected');
        configurazione.tensioneSelezionato = tensioni[0];

        if (configurazione.isFlussoProfiliEsterni) {
            caricaOpzioniIPStandalone(configurazione.tensioneSelezionato, configurazione.tipologiaStripSelezionata, configurazione.specialStripSelezionata);
        } else {
            caricaOpzioniIP(configurazione.profiloSelezionato, configurazione.tensioneSelezionato);
        }
      }
    }, 50);
  }

  $('.tensione-card').off('click').on('click', function() {
    $('.tensione-card').removeClass('selected');
    $(this).addClass('selected');
    configurazione.tensioneSelezionato = $(this).data('tensione');

    if (configurazione.isFlussoProfiliEsterni) {
        caricaOpzioniIPStandalone(configurazione.tensioneSelezionato, configurazione.tipologiaStripSelezionata, configurazione.specialStripSelezionata);
    } else {
        caricaOpzioniIP(configurazione.profiloSelezionato, configurazione.tensioneSelezionato);
    }
    
    checkParametriCompletion();
  });
}

function checkPersonalizzazioneComplete() {
  if (!configurazione.formaDiTaglioSelezionata) {
    alert("Seleziona una forma di taglio prima di continuare");
    return false;
  }

  if (!configurazione.finituraSelezionata) {
    alert("Seleziona una finitura prima di continuare");
    return false;
  }

  if (configurazione.tipologiaSelezionata === 'profilo_intero') {
    return true;
  }

  if (configurazione.tipologiaSelezionata === 'taglio_misura') {
    if (configurazione.formaDiTaglioSelezionata === 'DRITTO_SEMPLICE') {
      if (!configurazione.lunghezzaRichiesta) {
        alert("Inserisci una lunghezza prima di continuare");
        return false;
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
        alert("Inserisci tutte le misure richieste per questa forma");
        return false;
      }
    } else {
      alert("Inserisci le misure richieste per questa forma");
      return false;
    }
  }
  return true;
}

export function forceBtnProfiloIntero() {
  if (configurazione.tipologiaSelezionata === 'profilo_intero') {
    if (!configurazione.formaDiTaglioSelezionata) {
      configurazione.formaDiTaglioSelezionata = 'DRITTO_SEMPLICE';
    }

    if (!configurazione.lunghezzaRichiesta && configurazione.lunghezzaMassimaProfilo) {
      configurazione.lunghezzaRichiesta = configurazione.lunghezzaMassimaProfilo;
    } else if (!configurazione.lunghezzaRichiesta) {
      configurazione.lunghezzaRichiesta = 3000;
    }
    $('#btn-continua-personalizzazione').prop('disabled', false);
    return true;
  }
  return false;
}

function caricaOpzioniIPStandalone(tensione, tipologiaStrip, specialStrip) {
  if (isLoadingIP) {
    return;
  }
  isLoadingIP = true;
  
  $('#ip-options').empty().html('<div class="spinner-border" role="status"></div><p>Caricamento opzioni IP...</p>');

  $.ajax({
      url: '/get_opzioni_ip_standalone',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
          tensione: tensione,
          tipologia: tipologiaStrip,
          special: specialStrip
      }),
      success: function(data) {
          
          $('#ip-options').empty();
          
          if (data.success && data.gradi_ip && data.gradi_ip.length > 0) {

              const mappaIP = {
                  'IP20': 'IP20 (Interni)',
                  'IP65': 'IP65 (Resistente all\'umidità)',
                  'IP66': 'IP66 (Resistente all\'acqua)',
                  'IP67': 'IP67 (Esterni)'
              };
              
              data.gradi_ip.forEach(function(ip) {
                  const nomeVisualizzato = mappaIP[ip] || ip;
                  $('#ip-options').append(`
                      <div class="col-md-4 mb-3">
                          <div class="card option-card ip-card" data-ip="${ip}">
                              <div class="card-body text-center">
                                  <h5 class="card-title">${nomeVisualizzato}</h5>
                              </div>
                          </div>
                      </div>
                  `);
              });

              if (data.gradi_ip.length === 1) {
                setTimeout(() => {
                    $('.ip-card').addClass('selected');
                    configurazione.ipSelezionato = data.gradi_ip[0];
                    isLoadingIP = false;
                    caricaOpzioniTemperaturaStandalone(configurazione.tensioneSelezionato, data.gradi_ip[0], configurazione.tipologiaStripSelezionata, configurazione.specialStripSelezionata);
                }, 50);
            } else {
                isLoadingIP = false;
            }

              $('.ip-card').off('click').on('click', function() {
                $('.ip-card').removeClass('selected');
                $(this).addClass('selected');
                configurazione.ipSelezionato = $(this).data('ip');
                caricaOpzioniTemperaturaStandalone(configurazione.tensioneSelezionato, configurazione.ipSelezionato, configurazione.tipologiaStripSelezionata, configurazione.specialStripSelezionata);
                checkParametriCompletion();
            });
          } else {
              $('#ip-options').html('<p class="text-danger">Nessuna opzione IP disponibile per questa configurazione.</p>');
              isLoadingIP = false;
          }
      },
      error: function(xhr, status, error) {
          console.error("Errore AJAX IP:", error);
          $('#ip-options').html('<p class="text-danger">Errore nel caricamento delle opzioni IP.</p>');
          isLoadingIP = false;
      }
  });
}

function caricaOpzioniTemperaturaStandalone(tensione, ip, tipologiaStrip, specialStrip) {
  if (isLoadingTemperatura) {
    return;
  }
  isLoadingTemperatura = true;
  
  $('#temperatura-iniziale-options').empty().html('<div class="spinner-border" role="status"></div><p>Caricamento temperature...</p>');

  $.ajax({
      url: '/get_opzioni_temperatura_standalone',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
          tipologia: tipologiaStrip,
          tensione: tensione,
          ip: ip,
          special: specialStrip,
          categoria: configurazione.categoriaSelezionata
      }),
      success: function(data) {
          $('#temperatura-iniziale-options').empty();
          
          if (!data.success) {
              $('#temperatura-iniziale-options').html('<p class="text-danger">Errore nel caricamento delle temperature.</p>');
              isLoadingTemperatura = false;
              return;
          }
          
          if (!data.temperature || data.temperature.length === 0) {
              $('#temperatura-iniziale-options').html(`
                  <div class="col-12">
                      <div class="alert alert-warning">
                          <p>Nessuna temperatura disponibile per questa combinazione.</p>
                          <p class="small">Parametri: ${tipologiaStrip}${specialStrip ? ` (${specialStrip})` : ''}, ${tensione}, ${ip}</p>
                      </div>
                  </div>
              `);
              isLoadingTemperatura = false;
              return;
          }

          data.temperature.forEach(function(temp) {
              $('#temperatura-iniziale-options').append(`
                  <div class="col-md-4 mb-3">
                      <div class="card option-card temperatura-card" data-temperatura="${temp}">
                          <div class="card-body text-center">
                              <h5 class="card-title">${formatTemperatura(temp)}</h5>
                              <div class="temperatura-color-preview" style="background: ${getTemperaturaColor(temp)};"></div>
                          </div>
                      </div>
                  </div>
              `);
          });

          if (data.temperature.length === 1) {
            setTimeout(() => {
                const $unicaTemperatura = $('.temperatura-card');
                $unicaTemperatura.addClass('selected');
                configurazione.temperaturaSelezionata = data.temperature[0];
                configurazione.temperaturaColoreSelezionata = configurazione.temperaturaSelezionata;
                
                isLoadingTemperatura = false;
                checkParametriCompletion();
            }, 50);
          } else {
              isLoadingTemperatura = false;
          }

          $('.temperatura-card').off('click').on('click', function() {
            $('.temperatura-card').removeClass('selected');
            $(this).addClass('selected');
            configurazione.temperaturaSelezionata = $(this).data('temperatura');
            configurazione.temperaturaColoreSelezionata = configurazione.temperaturaSelezionata;
            
            checkParametriCompletion();
        });
      },
      error: function(xhr, status, error) {
          console.error("Errore nel caricamento delle temperature:", error);
          $('#temperatura-iniziale-options').html('<p class="text-danger">Errore nel caricamento delle temperature.</p>');
          isLoadingTemperatura = false;
      }
  });
}

export function saltaAlimentazionePerEsterni() {
  configurazione.includeStripLed = true;

  $('#profilo-nome-step4').text(configurazione.nomeModello);
  $('#tipologia-nome-step4').text(mappaTipologieVisualizzazione[configurazione.tipologiaSelezionata] || configurazione.tipologiaSelezionata);
  $('#strip-nome-step4').text(configurazione.nomeCommercialeStripLed || configurazione.stripLedSelezionata);
  
  if (configurazione.potenzaSelezionata) {
      $('#badge-potenza-step4').show();
      $('#potenza-nome-step4').text(configurazione.potenzaSelezionata);
  } else {
      $('#badge-potenza-step4').hide();
  }

  if (configurazione.potenzaSelezionata && configurazione.lunghezzaRichiesta) {
      const potenzaPerMetro = parseFloat(configurazione.potenzaSelezionata.split('W/m')[0]) || 0;
      const lunghezzaMetri = configurazione.lunghezzaRichiesta / 1000;
      const moltiplicatore = configurazione.moltiplicatoreStrip || 1;
      const potenzaTotale = potenzaPerMetro * lunghezzaMetri * moltiplicatore * 1.2;

      configurazione.potenzaConsigliataAlimentatore = Math.ceil(potenzaTotale / 10) * 10;
  }
  
  updateProgressBar(6);
  
  $("#step2-personalizzazione").fadeOut(300, function() {
      $("#step4-alimentazione").fadeIn(300);

      $('.alimentazione-card').removeClass('selected');
      $('#alimentatore-section').hide();
      $('#potenza-alimentatore-section').hide();
      $('#btn-continua-step4').prop('disabled', true);
      configurazione.alimentazioneSelezionata = null;
      configurazione.tipologiaAlimentatoreSelezionata = null;
      configurazione.potenzaAlimentatoreSelezionata = null;

      import('./step4.js').then(module => {
        module.prepareAlimentazioneListeners();
      });
  });
}

$('#btn-continua-personalizzazione').on('click', function(e) {
  e.preventDefault();
  
  if (!checkPersonalizzazioneComplete()) {
      return;
  }

  if (configurazione.isFlussoProfiliEsterni) {
      saltaAlimentazionePerEsterni();
  } else {
      vaiAlleOpzioniStripLed();
  }
});

$(document).ready(function() {
  $('#step2-personalizzazione').on('click', '.finitura-card', function() {
    setTimeout(function() {
      if (configurazione.tipologiaSelezionata === 'profilo_intero' && configurazione.finituraSelezionata) {
        $('#btn-continua-personalizzazione').prop('disabled', false);
      }
    }, 100);
  });
});