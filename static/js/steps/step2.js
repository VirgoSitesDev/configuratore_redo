import { configurazione, mappaTipologieVisualizzazione, mappaTensioneVisualizzazione, mappaIPVisualizzazione } from '../config.js';
import { updateProgressBar, checkPersonalizzazioneCompletion, formatTemperatura, checkParametriCompletion, getTemperaturaColor } from '../utils.js';
import { caricaFinitureDisponibili, finalizzaConfigurazione, caricaOpzioniIP } from '../api.js';
import { vaiAllaTemperaturaEPotenza } from './step3.js';
import { renderOpzioniIP } from './step0.js'

// Flag per prevenire chiamate multiple
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
      $("#step2-modello").fadeIn(300);
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
    
    // Reset dei flag quando si torna indietro
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
        $("#step1-tipologia").fadeIn(300);
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
      analizzaEMostraTipologieCompatibili();
    });
  } else {
    $("#step2-option-strip").fadeOut(300, function() {
      $("#step2-tipologia-strip").fadeIn(300);
      analizzaEMostraTipologieCompatibili();
    });
  }
}

export function analizzaTipologiePerEsterni() {
  // Rimuovi prima tutti gli event handler esistenti
  $('.tipologia-strip-card').off('click');
  $('.special-strip-card').off('click');
  
  $('.tipologia-strip-card').parent().hide();
  
  $('.tipologia-strip-card[data-tipologia-strip="SPECIAL"]').parent().show();
  
  setTimeout(() => {
    $('.tipologia-strip-card[data-tipologia-strip="SPECIAL"]').addClass('selected');
    configurazione.tipologiaStripSelezionata = 'SPECIAL';
    $('#special-strip-container').fadeIn(300);
    $('#btn-continua-tipologia-strip').prop('disabled', true);
  }, 100);
  
  // Registra i listener dopo la selezione automatica
  setTimeout(() => {
    prepareTipologiaStripListeners();
  }, 200);
}

function analizzaEMostraTipologieCompatibili() {
  if (configurazione.isFlussoProfiliEsterni) {
    analizzaTipologiePerEsterni();
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
        id.includes('RUNNING') || 
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
    'RUNNING': ['RUNNING'],
    'ZIG_ZAG': ['ZIGZAG', 'ZIG_ZAG', 'ZIGZAG'],
    'XSNAKE': ['XSNAKE', 'XSNAKE', 'SNAKE'],
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
  // Rimuovi event handler esistenti prima di aggiungerne di nuovi
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

    // Determina da quale step arriviamo
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
          <p class="alert-dialog mt-4">ATTENZIONE: la lunghezza richiesta fa riferimento alla strip led esclusa di tappi e il profilo risulterà leggermente più corto.</p>
        </div>
      `;
      
      $('#finitura-container').closest('.container').after(infoMessage);
    }
  });
}

export function preparePersonalizzazioneListeners() {
  caricaFinitureDisponibili(configurazione.profiloSelezionato);

  if (configurazione.categoriaSelezionata === 'esterni' || configurazione.categoriaSelezionata === 'wall_washer_ext') {
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
        <p class="alert-dialog mt-4">ATTENZIONE: la lunghezza richiesta fa riferimento alla strip led esclusa di tappi e il profilo risulterà leggermente più corto.</p>
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
      
      misurazioneContainer.html(`
        <div class="form-group mb-4 lunghezza-personalizzata-container">
          <label for="lunghezza-personalizzata">Lunghezza richiesta (mm):</label>
          <input type="number" class="form-control" id="lunghezza-personalizzata" 
                 placeholder="Inserisci la lunghezza in millimetri" min="100">
          <p class="assembly-warning mt-2">NOTA: la lunghezza massima per strip 24V è 10mt, per le strip 48V è 30mt mentre per le stip 220v è 50mt</p>
          <p class="alert-dialog mt-4">ATTENZIONE: la lunghezza richiesta fa riferimento alla strip led esclusa di tappi e il profilo risulterà leggermente più corto.</p>
        </div>
      `);

      $('#lunghezza-personalizzata').on('input', function() {
        configurazione.lunghezzaRichiesta = parseInt($(this).val(), 10) || null;
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
      
      misurazioneContainer.html(`
        <div class="form-group mb-3 lunghezza-personalizzata-container">
          <label for="lunghezza-lato1">Lunghezza lato orizzontale (mm):</label>
          <input type="number" class="form-control campo-lunghezza-multipla" id="lunghezza-lato1" 
                 data-lato="lato1" placeholder="Lato orizzontale" min="100">
        </div>
        <div class="form-group mb-4 lunghezza-personalizzata-container">
          <label for="lunghezza-lato2">Lunghezza lato verticale (mm):</label>
          <input type="number" class="form-control campo-lunghezza-multipla" id="lunghezza-lato2" 
                 data-lato="lato2" placeholder="Lato verticale" min="100">
          <p class="alert-dialog mt-4">ATTENZIONE: la lunghezza richiesta fa riferimento alla strip led esclusa di tappi e il profilo risulterà leggermente più corto.</p>
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
      
      misurazioneContainer.html(`
        <div class="form-group mb-3 lunghezza-personalizzata-container">
          <label for="lunghezza-lato1">Lunghezza lato orizzontale (mm):</label>
          <input type="number" class="form-control campo-lunghezza-multipla" id="lunghezza-lato1" 
                 data-lato="lato1" placeholder="Lato orizzontale" min="100">
        </div>
        <div class="form-group mb-4 lunghezza-personalizzata-container">
          <label for="lunghezza-lato2">Lunghezza lato verticale (mm):</label>
          <input type="number" class="form-control campo-lunghezza-multipla" id="lunghezza-lato2" 
                 data-lato="lato2" placeholder="Lato verticale" min="100">
          <p class="alert-dialog mt-4">ATTENZIONE: la lunghezza richiesta fa riferimento alla strip led esclusa di tappi e il profilo risulterà leggermente più corto.</p>
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
      
      misurazioneContainer.html(`
        <div class="form-group mb-3 lunghezza-personalizzata-container">
          <label for="lunghezza-lato1">Lunghezza lato orizzontale superiore (mm):</label>
          <input type="number" class="form-control campo-lunghezza-multipla" id="lunghezza-lato1" 
                 data-lato="lato1" placeholder="Lato orizzontale superiore" min="100">
        </div>
        <div class="form-group mb-3 lunghezza-personalizzata-container">
          <label for="lunghezza-lato2">Lunghezza lato verticale (mm):</label>
          <input type="number" class="form-control campo-lunghezza-multipla" id="lunghezza-lato2" 
                 data-lato="lato2" placeholder="Lato verticale" min="100">
        </div>
        <div class="form-group mb-4 lunghezza-personalizzata-container">
          <label for="lunghezza-lato3">Lunghezza lato orizzontale inferiore (mm):</label>
          <input type="number" class="form-control campo-lunghezza-multipla" id="lunghezza-lato3" 
                 data-lato="lato3" placeholder="Lato orizzontale inferiore" min="100">
          <p class="alert-dialog mt-4">ATTENZIONE: la lunghezza richiesta fa riferimento alla strip led esclusa di tappi e il profilo risulterà leggermente più corto.</p>
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
      
      misurazioneContainer.html(`
        <div class="form-group mb-3 lunghezza-personalizzata-container">
          <label for="lunghezza-lato1">Lunghezza (mm):</label>
          <input type="number" class="form-control campo-lunghezza-multipla" id="lunghezza-lato1" 
                 data-lato="lato1" placeholder="Lunghezza" min="100">
        </div>
        <div class="form-group mb-4 lunghezza-personalizzata-container">
          <label for="lunghezza-lato2">Larghezza (mm):</label>
          <input type="number" class="form-control campo-lunghezza-multipla" id="lunghezza-lato2" 
                 data-lato="lato2" placeholder="Larghezza" min="100">
          <p class="alert-dialog mt-4">ATTENZIONE: la lunghezza richiesta fa riferimento alla strip led esclusa di tappi e il profilo risulterà leggermente più corto.</p>
        </div>
      `);
      mostraNonAssemblatoWarning();
      break;
      
    default:
      istruzioniContainer.html(`<p>Seleziona una forma di taglio per visualizzare le istruzioni.</p>`);
  }

  $('.campo-lunghezza-multipla').on('input', function() {
    const lato = $(this).data('lato');
    const valore = parseInt($(this).val(), 10) || null;

    if (!configurazione.lunghezzeMultiple) {
      configurazione.lunghezzeMultiple = {};
    }
    
    configurazione.lunghezzeMultiple[lato] = valore;

    let sommaLunghezze = 0;
    let tuttiValoriPresenti = true;
    
    Object.values(configurazione.lunghezzeMultiple).forEach(val => {
      if (val && val > 0) {
        sommaLunghezze += val;
      } else {
        tuttiValoriPresenti = false;
      }
    });
    
    if (tuttiValoriPresenti) {
      configurazione.lunghezzaRichiesta = sommaLunghezze;
    } else {
      configurazione.lunghezzaRichiesta = null;
    }
    
    checkPersonalizzazioneCompletion();
  });
}

function mostraNonAssemblatoWarning() {
  if ($('#non-assemblato-warning').length === 0) {
    const warningHtml = `
      <div id="non-assemblato-warning" class="assembly-warning mt-0 mb-4">
        <p>NOTA: la lunghezza massima per strip 24V è 10mt, per le strip 48V è 30mt mentre per le stip 220v è 50mt</p>
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
  // Reset dei flag quando si va ai parametri
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
  // Reset dei flag quando si inizia una nuova serie di caricamenti
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
    $.ajax({
      url: `/get_opzioni_tensione/${configurazione.profiloSelezionato}/${configurazione.tipologiaStripSelezionata}`,
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

        // IMPORTANTE: Controlla se siamo nel flusso esterni
        if (configurazione.isFlussoProfiliEsterni) {
            console.log("Flusso esterni (auto): chiamo caricaOpzioniIPStandalone");
            caricaOpzioniIPStandalone(configurazione.tensioneSelezionato, configurazione.tipologiaStripSelezionata, configurazione.specialStripSelezionata);
        } else {
            console.log("Flusso normale (auto): chiamo caricaOpzioniIP");
            caricaOpzioniIP(configurazione.profiloSelezionato, configurazione.tensioneSelezionato);
        }
      }
    }, 50);
  }

  // Rimuovi event handler esistenti prima di aggiungerne di nuovi
  $('.tensione-card').off('click').on('click', function() {
    $('.tensione-card').removeClass('selected');
    $(this).addClass('selected');
    configurazione.tensioneSelezionato = $(this).data('tensione');

    // IMPORTANTE: Controlla se siamo nel flusso esterni
    if (configurazione.isFlussoProfiliEsterni) {
        console.log("Flusso esterni: chiamo caricaOpzioniIPStandalone");
        caricaOpzioniIPStandalone(configurazione.tensioneSelezionato, configurazione.tipologiaStripSelezionata, configurazione.specialStripSelezionata);
    } else {
        console.log("Flusso normale: chiamo caricaOpzioniIP");
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
  // Previeni chiamate multiple
  if (isLoadingIP) {
    console.log("Già in caricamento IP, skip");
    return;
  }
  isLoadingIP = true;
  
  $('#ip-options').empty().html('<div class="spinner-border" role="status"></div><p>Caricamento opzioni IP...</p>');
  
  console.log("Chiamata IP con parametri:", {
      tensione: tensione,
      tipologia: tipologiaStrip,
      special: specialStrip
  });
  
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
          console.log("Risposta IP ricevuta:", data);
          
          $('#ip-options').empty();
          
          if (data.success && data.gradi_ip && data.gradi_ip.length > 0) {
              console.log("Opzioni IP trovate:", data.gradi_ip);
              
              // Renderizza direttamente le opzioni IP
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
              
              // Se c'è solo un'opzione, selezionala automaticamente
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
              
              // Rimuovi event handler esistenti prima di aggiungerne di nuovi
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
  // Previeni chiamate multiple
  if (isLoadingTemperatura) {
    console.log("Già in caricamento temperatura, skip");
    return;
  }
  isLoadingTemperatura = true;
  
  $('#temperatura-iniziale-options').empty().html('<div class="spinner-border" role="status"></div><p>Caricamento temperature...</p>');
  
  // Per gli esterni, usa l'endpoint filtrato
  if (configurazione.isFlussoProfiliEsterni) {
      $.ajax({
          url: `/get_opzioni_temperatura_filtrate_esterni/${tensione}/${ip}/${tipologiaStrip}`,
          method: 'GET',
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
                          </div>
                      </div>
                  `);
                  isLoadingTemperatura = false;
                  return;
              }
              
              // Mostra le temperature disponibili
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
                  checkParametriCompletion();
              });
          },
          error: function(error) {
              console.error("Errore nel caricamento delle temperature filtrate:", error);
              $('#temperatura-iniziale-options').html('<p class="text-danger">Errore nel caricamento delle temperature.</p>');
              isLoadingTemperatura = false;
          }
      });
  }
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
      const potenzaTotale = potenzaPerMetro * lunghezzaMetri * 1.2;

      configurazione.potenzaConsigliataAlimentatore = Math.ceil(potenzaTotale / 10) * 10;
      
      console.log("Potenza calcolata:", {
          potenzaPerMetro,
          lunghezzaMetri,
          potenzaTotale,
          potenzaConsigliata: configurazione.potenzaConsigliataAlimentatore
      });
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