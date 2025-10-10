import { configurazione, mappaTipologieVisualizzazione, mappaStripLedVisualizzazione } from '../config.js';
import { updateProgressBar, checkStep5Completion } from '../utils.js';
import { vaiAlleProposte } from './step6.js'


export function initStep5Listeners() {
  $('#btn-torna-step4').on('click', function(e) {
    e.preventDefault();
    
    $("#step5-controllo").fadeOut(300, function() {
      if (configurazione.tensioneSelezionato === '220V') {
        if (configurazione.isFlussoProfiliEsterni) {
          $("#step4-alimentazione").fadeIn(300);
          updateProgressBar(4);
        } else {
          $("#step3-temperatura-potenza").fadeIn(300);
          updateProgressBar(3);
        }
      } else {
        $("#step4-alimentazione").fadeIn(300);
        updateProgressBar(4);
      }
    });
  });
  
  $('#btn-continua-step5').on('click', function(e) {
    e.preventDefault();
    
    if (!configurazione.dimmerSelezionato) {
      alert("Seleziona un'opzione dimmer prima di continuare");
      return;
    }
    
    if (!configurazione.tipoAlimentazioneCavo) {
      alert("Seleziona il tipo di alimentazione cavo prima di continuare");
      return;
    }
    
    if (!configurazione.uscitaCavoSelezionata) {
      alert("Seleziona l'uscita cavo prima di continuare");
      return;
    }
    $("#step5-controllo").fadeOut(300, function() {
      vaiAlleProposte();
    });
  });
}

function caricaDimmerCompatibili() {
  if (configurazione.alimentazioneSelezionata === 'SENZA_ALIMENTATORE') {
    configurazione.dimmerSelezionato = "NESSUN_DIMMER";
    configurazione.dimmerCodice = "";

    $('#dimmer-container').parent().hide();
    
    checkStep5Completion();
    return;
  }

  $('#dimmer-container').empty().html(`
    <h3 class="mb-3">Dimmer</h3>
    <div class="text-center" id="dimmer-loading">
      <div class="spinner-border" role="status"></div>
      <p class="mt-3">Caricamento opzioni dimmer compatibili...</p>
    </div>
  `);

  let potenzaTotale = calcolaPotenzaTotaleStrip();

  if (configurazione.tensioneSelezionato === '220V') {
    const dimmerHtml = `
      <h3 class="mb-3">Dimmer</h3>
      <div class="alert alert-info mb-3">
        <strong>Nota:</strong> Per strip LED 220V sono disponibili le seguenti opzioni di dimmer.
      </div>
      <div class="row">
        <div class="col-md-4 mb-3 dimmer-column">
          <div class="card option-card dimmer-card" data-dimmer="DIMMERABILE_TRIAC_PULSANTE_TUYA_220V" data-codice="CTR130" data-potenza-max="200">
            <img src="/static/img/dimmer/dimmer_pulsante.jpg" class="card-img-top" alt="CTR130" style="height: 180px; object-fit: cover;" onerror="this.src='/static/img/placeholder_logo.jpg'; this.style.height='180px'">
            <div class="card-body text-center">
              <h5 class="card-title">CTR130 - Dimmer a pulsante</h5>
              <p class="card-text small text-muted">Dimmerabile TRIAC tramite pulsante e compatibile con sistema TUYA</p>
              ${potenzaTotale > 200 ? '<p class="card-text small text-danger">Attenzione: Potenza richiesta superiore al limite massimo!</p>' : ''}
            </div>
          </div>
        </div>
        
        <div class="col-md-4 mb-3 dimmer-column">
          <div class="card option-card dimmer-card" data-dimmer="NESSUN_DIMMER">
            <div class="card-body text-center d-flex flex-column justify-content-center" style="min-height: 180px;">
              <h5 class="card-title">Nessun dimmer</h5>
              <p class="card-text small text-muted">Installazione senza controllo di luminosità</p>
            </div>
          </div>
        </div>
      </div>
    `;
    
    $('#dimmer-container').html(dimmerHtml);
    bindDimmerCardListeners();
    checkStep5Completion();
    return;
  }

  if (!configurazione.stripLedSelezionata || 
      configurazione.stripLedSelezionata === 'senza_strip' || 
      configurazione.stripLedSelezionata === 'NO_STRIP') {
    
    const dimmerHtml = `
      <h3 class="mb-3">Dimmer</h3>
      <div class="row">
        <div class="col-md-4 mb-3 dimmer-column">
          <div class="card option-card dimmer-card" data-dimmer="NESSUN_DIMMER">
            <div class="card-body text-center d-flex flex-column justify-content-center" style="min-height: 180px;">
              <h5 class="card-title">Nessun dimmer</h5>
              <p class="card-text small text-muted">Installazione senza controllo di luminosità</p>
            </div>
          </div>
        </div>
      </div>
    `;
    
    $('#dimmer-container').html(dimmerHtml);
    $('.dimmer-card').addClass('selected');
    configurazione.dimmerSelezionato = "NESSUN_DIMMER";
    configurazione.dimmerCodice = "";
    
    bindDimmerCardListeners();
    checkStep5Completion();
    return;
  }

  $('#dimmer-loading').show();
  const potenzeMassimeDimmer = {
    "DIMMER_TOUCH_SU_PROFILO_PRFTSW01": 120,
    "DIMMER_TOUCH_SU_PROFILO_PRFTDIMM01": 120,
    "DIMMER_TOUCH_SU_PROFILO_PRFIRSW01": 192,
    "DIMMER_TOUCH_SU_PROFILO_PRFIRDIMM01": 192,
    "DIMMER_PWM_CON_TELECOMANDO_RGB_RGBW": 576,
    "DIMMER_PWM_CON_TELECOMANDO_MONOCOLORE": 144,
    "DIMMER_PWM_CON_TELECOMANDO_TUNABLE_WHITE": 288,
    "DIMMER_PWM_CON_PULSANTE_24V_MONOCOLORE": 288,
    "DIMMER_PWM_CON_PULSANTE_48V_MONOCOLORE": 336,
    "DIMMERABILE_PWM_CON_SISTEMA_TUYA_MONOCOLORE": 144,
    "DIMMERABILE_PWM_CON_SISTEMA_TUYA_TUNABLE_WHITE": 144,
    "DIMMERABILE_PWM_CON_SISTEMA_TUYA_RGB": 144,
    "DIMMERABILE_PWM_CON_SISTEMA_TUYA_RGBW": 144,
    "DIMMERABILE_TRIAC_PULSANTE_TUYA_220V": 200,
    "DIMMER_PWM_DA_SCATOLA_CON_PULSANTE_NA": 192,
    "NESSUN_DIMMER": 9999
  };

  $.ajax({
    url: `/get_opzioni_dimmerazione/${configurazione.stripLedSelezionata}`,
    method: 'GET',
    success: function(response) {
      if (response.success) {
        let opzioniDimmer = response.opzioni || [];

        if (!opzioniDimmer.includes('NESSUN_DIMMER')) {
          opzioniDimmer.push('NESSUN_DIMMER');
        }

        const isRGBStrip = [
          "STRIP_24V_RGB_COB_IP20",
          "STRIP_24V_RGB_COB_IP66",
          "STRIP_24V_RGB_SMD_IP20",
          "STRIP_24V_RGB_SMD_IP66"
        ].includes(configurazione.stripLedSelezionata);

        if (isRGBStrip && configurazione.temperaturaColoreSelezionata) {
          opzioniDimmer = opzioniDimmer.filter(dimmer => {
            if (dimmer === "DIMMERABILE_PWM_CON_SISTEMA_TUYA_RGB") {
              return configurazione.temperaturaColoreSelezionata === 'RGB';
            }
            if (dimmer === "DIMMERABILE_PWM_CON_SISTEMA_TUYA_RGBW") {
              return configurazione.temperaturaColoreSelezionata === 'RGBW';
            }
            return true;
          });
        }

        const isExternalProfile = configurazione.categoriaSelezionata === 'esterni' || configurazione.categoriaSelezionata === 'wall_washer_ext';
        
        if (isExternalProfile) {
          opzioniDimmer = opzioniDimmer.filter(dimmer => 
            !dimmer.includes('DIMMER_TOUCH_SU_PROFILO_') && 
            !dimmer.includes('PRFTSW') && 
            !dimmer.includes('PRFTDIMM') && 
            !dimmer.includes('PRFIRSW') && 
            !dimmer.includes('PRFIRDIMM')
          );
        }

        if (configurazione.alimentazioneSelezionata === "DIMMERABILE_TRIAC") {
          opzioniDimmer = opzioniDimmer.filter(dimmer =>
            dimmer.includes("DIMMERABILE_TRIAC_PULSANTE_TUYA_220V") ||
            dimmer.includes("NESSUN_DIMMER")
          );
        } else if (configurazione.alimentazioneSelezionata === "ON-OFF") {
          opzioniDimmer = opzioniDimmer.filter(dimmer =>
            !dimmer.includes("DIMMERABILE_TRIAC_PULSANTE_TUYA_220V")
          );
        }

        opzioniDimmer = opzioniDimmer.filter(dimmer => {
          const potenzaMassima = potenzeMassimeDimmer[dimmer] || 0;
          return potenzaMassima >= potenzaTotale;
        });

        // Build dimmerCategories dynamically from database famiglia field
        const dimmerCategories = {};

        // Add NESSUN_DIMMER category
        dimmerCategories["NESSUN_DIMMER"] = ["NESSUN_DIMMER"];

        // Build categories from famiglieDimmer field in database response
        const famiglieDimmer = response.famiglieDimmer || {};
        Object.keys(famiglieDimmer).forEach(dimmerId => {
          const famiglie = famiglieDimmer[dimmerId];
          if (Array.isArray(famiglie)) {
            famiglie.forEach(famiglia => {
              if (!dimmerCategories[famiglia]) {
                dimmerCategories[famiglia] = [];
              }
              dimmerCategories[famiglia].push(dimmerId);
            });
          }
        });

        const categorieDisponibili = {};

        Object.keys(dimmerCategories).forEach(categoria => {
          const dimmerInCategoria = dimmerCategories[categoria].filter(d => opzioniDimmer.includes(d));
          if (dimmerInCategoria.length > 0) {
            categorieDisponibili[categoria] = dimmerInCategoria;
          }
        });

        if (Object.keys(categorieDisponibili).length === 0 || 
            (Object.keys(categorieDisponibili).length === 1 && Object.keys(categorieDisponibili)[0] === 'NESSUN_DIMMER')) {
          $('#dimmer-container').parent().hide();
          configurazione.dimmerSelezionato = "NESSUN_DIMMER";
          configurazione.dimmerCodice = "";
          
          checkStep5Completion();
          return;
        }

        const dimmerCategoryImages = {
          "TOUCH_SU_PROFILO": "/static/img/dimmer/touch_su_profilo.jpg",
          "CON_TELECOMANDO": "/static/img/dimmer/con_telecomando.jpg",
          "CON_PULSANTE": "/static/img/dimmer/dimmer_pulsante.jpg", 
          "SISTEMA_TUYA": "/static/img/dimmer/centralina_tuya.jpg",
          "DALI": "/static/img/dimmer/dimmer_pulsante_48v.jpg",
          "NESSUN_DIMMER": "/static/img/placeholder_logo.jpg"
        };

        const categoryDisplayNames = {
          "TOUCH_SU_PROFILO": "Touch su profilo",
          "CON_TELECOMANDO": "Con telecomando",
          "CON_PULSANTE": "Con pulsante",
          "SISTEMA_TUYA": "Sistema Tuya",
          "DALI": "Dali",
          "NESSUN_DIMMER": "Nessun dimmer"
        };

        const dimmerImages = {
          "DIMMER_TOUCH_SU_PROFILO_PRFTSW01": "/static/img/dimmer/touch_su_profilo.jpg",
          "DIMMER_TOUCH_SU_PROFILO_PRFTDIMM01": "/static/img/dimmer/touch_su_profilo_dim.jpg",
          "DIMMER_TOUCH_SU_PROFILO_PRFIRSW01": "/static/img/dimmer/ir_su_profilo.jpg",
          "DIMMER_TOUCH_SU_PROFILO_PRFIRDIMM01": "/static/img/dimmer/ir_su_profilo_dim.jpg",
          "DIMMER_PWM_CON_TELECOMANDO_RGB_RGBW": "/static/img/dimmer/con_telecomando_rgb.jpg",
          "DIMMER_PWM_CON_TELECOMANDO_MONOCOLORE": "/static/img/dimmer/con_telecomando.jpg",
          "DIMMER_PWM_CON_TELECOMANDO_TUNABLE_WHITE": "/static/img/dimmer/con_telecomando_cct.jpg",
          "DIMMER_PWM_CON_PULSANTE_24V_MONOCOLORE": "/static/img/dimmer/dimmer_pulsante.jpg",
          "DIMMER_PWM_CON_PULSANTE_48V_MONOCOLORE": "/static/img/dimmer/dimmer_pulsante_48v.jpg",
          "DIMMERABILE_PWM_CON_SISTEMA_TUYA_MONOCOLORE": "/static/img/dimmer/centralina_tuya.jpg",
          "DIMMERABILE_PWM_CON_SISTEMA_TUYA_TUNABLE_WHITE": "/static/img/dimmer/centralina_tuya_cct.jpg",
          "DIMMERABILE_PWM_CON_SISTEMA_TUYA_RGB": "/static/img/dimmer/centralina_tuya_rgb.jpg",
          "DIMMERABILE_PWM_CON_SISTEMA_TUYA_RGBW": "/static/img/dimmer/centralina_tuya_rgbw.jpg",
          "DIMMERABILE_TRIAC_PULSANTE_TUYA_220V": "/static/img/dimmer/dimmer_triac_220v.jpg",
          "DIMMER_PWM_DA_SCATOLA_CON_PULSANTE_NA": "/static/img/dimmer/dimmer_scatola.jpg",
          "NESSUN_DIMMER": "/static/img/placeholder_logo.jpg"
        };

        // Debug: Log dimmer images from database
        console.log('Database dimmer images (immaginiDimmer):', response.immaginiDimmer);

        window.dimmerData = {
          categories: categorieDisponibili,
          nomiDimmer: response.nomiDimmer || {},
          codiciDimmer: response.codiciDimmer || {},
          spaziNonIlluminati: response.spaziNonIlluminati || {},
          potenzeMassime: potenzeMassimeDimmer || {},
          immaginiDimmer: response.immaginiDimmer || {}
        };

        if (Object.keys(categorieDisponibili).length === 1 && Object.keys(categorieDisponibili)[0] === 'NESSUN_DIMMER') {
          const dimmerHtml = `
            <h3 class="mb-3">Dimmer</h3>
            <div class="row">
              <div class="col-md-4 mb-3 dimmer-column">
                <div class="card option-card dimmer-card" data-dimmer="NESSUN_DIMMER">
                  <div class="card-body text-center d-flex flex-column justify-content-center" style="min-height: 180px;">
                    <h5 class="card-title">Nessun dimmer</h5>
                    <p class="card-text small text-muted">Installazione senza controllo di luminosità</p>
                  </div>
                </div>
              </div>
            </div>
          `;
          
          $('#dimmer-container').html(dimmerHtml);
          $('.dimmer-card').addClass('selected');
          configurazione.dimmerSelezionato = "NESSUN_DIMMER";
          configurazione.dimmerCodice = "";
          
          bindDimmerCardListeners();
          checkStep5Completion();
          return;
        }

        let dimmerHtml = `<h3 class="mb-3">Dimmer</h3>`;

        dimmerHtml += `
          <div class="mb-4">
            <h5 class="mb-3">1. Seleziona la categoria di dimmer</h5>
            <div class="row" id="dimmer-categories-container">
        `;

        Object.keys(categorieDisponibili).forEach(categoria => {
          if (categoria === 'NESSUN_DIMMER') {
            dimmerHtml += `
              <div class="col-md-4 mb-3 dimmer-category-column">
                <div class="card option-card dimmer-category-card" data-categoria="${categoria}">
                  <div class="card-body text-center d-flex flex-column justify-content-center" style="min-height: 150px;">
                    <h5 class="card-title">${categoryDisplayNames[categoria]}</h5>
                    <p class="card-text small text-muted">${categorieDisponibili[categoria].length} ${categorieDisponibili[categoria].length === 1 ? 'opzione disponibile' : 'opzioni disponibili'}</p>
                  </div>
                </div>
              </div>
            `;
          } else {
            dimmerHtml += `
              <div class="col-md-4 mb-3 dimmer-category-column">
                <div class="card option-card dimmer-category-card" data-categoria="${categoria}">
                  <img src="${dimmerCategoryImages[categoria]}" class="card-img-top" alt="${categoryDisplayNames[categoria]}" 
                       style="height: 150px; object-fit: cover;" 
                       onerror="this.src='/static/img/placeholder_logo.jpg'; this.style.height='150px'">
                  <div class="card-body text-center">
                    <h5 class="card-title">${categoryDisplayNames[categoria]}</h5>
                    <p class="card-text small text-muted">${categorieDisponibili[categoria].length} ${categorieDisponibili[categoria].length === 1 ? 'opzione disponibile' : 'opzioni disponibili'}</p>
                  </div>
                </div>
              </div>
            `;
          }
        });
        
        dimmerHtml += `
            </div>
          </div>
        `;

        dimmerHtml += `
          <div id="dimmer-specific-section" style="display: none;">
            <h5 class="mb-3">2. Seleziona il modello specifico <span id="categoria-selezionata-label"></span></h5>
            <div class="row" id="dimmer-specific-container"></div>
          </div>
          
          <div id="dimmer-warning" class="alert alert-warning mt-3" style="display: none;">
            <strong style="color:#ff0000 !important;">Nota:</strong> Con l'opzione Touch/IR su profilo ci sarà uno spazio non illuminato di 50mm.
          </div>
        `;

        $('#dimmer-container').html(dimmerHtml);
        $('#dimmer-loading').hide();
        
        $('.dimmer-category-card').on('click', function() {
          $('.dimmer-category-card').removeClass('selected');
          $(this).addClass('selected');
          
          const categoria = $(this).data('categoria');

          if (categoria === 'NESSUN_DIMMER') {
            $('#dimmer-specific-section').hide();

            configurazione.dimmerSelezionato = "NESSUN_DIMMER";
            configurazione.dimmerCodice = "";

            $('#dimmer-warning').hide();
            checkStep5Completion();
            return;
          }

          $('#categoria-selezionata-label').text(`di ${categoryDisplayNames[categoria]}`);
          mostraDimmerSpecifici(categoria, dimmerImages, response, potenzaTotale);
        });

        if (Object.keys(categorieDisponibili).length === 1) {
          const unicaCategoria = Object.keys(categorieDisponibili)[0];

          $(`.dimmer-category-card[data-categoria="${unicaCategoria}"]`).addClass('selected');
          $('#categoria-selezionata-label').text(`di ${categoryDisplayNames[unicaCategoria]}`);

          if (unicaCategoria === 'NESSUN_DIMMER') {
            configurazione.dimmerSelezionato = "NESSUN_DIMMER";
            configurazione.dimmerCodice = "";
            checkStep5Completion();
          } else {
            mostraDimmerSpecifici(unicaCategoria, dimmerImages, response, potenzaTotale);
          }

          if (categorieDisponibili[unicaCategoria].length === 1) {
            setTimeout(function() {
              const unicoDimmer = categorieDisponibili[unicaCategoria][0];
              $(`.dimmer-specific-card[data-dimmer="${unicoDimmer}"]`).click();
            }, 200);
          }
        }
        
        checkStep5Completion();
      } else {
        console.error("Errore nel caricamento dei dimmer compatibili:", response.message);
        $('#dimmer-container').parent().hide();
        configurazione.dimmerSelezionato = "NESSUN_DIMMER";
        configurazione.dimmerCodice = "";
        
        checkStep5Completion();
      }
    },
    error: function(error) {
      console.error("Errore nella chiamata API dei dimmer:", error);
      $('#dimmer-container').parent().hide();
      configurazione.dimmerSelezionato = "NESSUN_DIMMER";
      configurazione.dimmerCodice = "";
      
      $('#dimmer-loading').hide();
      checkStep5Completion();
    }
  });
}

function calcolaPotenzaTotaleStrip() {
  if (configurazione.stripLedSelezionata === 'NO_STRIP' || 
      !configurazione.potenzaSelezionata) {
    return 0;
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

  const potenzaTotale = potenzaPerMetro * lunghezzaMetri * 1.2;
  
  return potenzaTotale;
}

function mostraDimmerSpecifici(categoria, dimmerImages, response, potenzaTotale) {
  const dimmerData = window.dimmerData;
  const dimmerInCategoria = dimmerData.categories[categoria];
  const specificContainer = $('#dimmer-specific-container');
  specificContainer.empty();

  if (categoria === 'NESSUN_DIMMER') {
    return;
  } else {
    dimmerInCategoria.forEach(dimmer => {
      const dimmerText = dimmerData.nomiDimmer[dimmer] || dimmer;
      const dimmerCode = dimmerData.codiciDimmer[dimmer] || "";
      const spazioNonIlluminato = dimmerData.spaziNonIlluminati[dimmer];
      const potenzaMassima = dimmerData.potenzeMassime[dimmer] || 0;
      // Use database image first (priority), fallback to hardcoded image, then placeholder
      const imgPath = dimmerData.immaginiDimmer[dimmer] || dimmerImages[dimmer] || "/static/img/placeholder_logo.jpg";

      // Debug: Log image selection for each dimmer
      console.log(`Dimmer ${dimmer}:`, {
        databasePath: dimmerData.immaginiDimmer[dimmer],
        hardcodedPath: dimmerImages[dimmer],
        finalPath: imgPath
      });

      const potenzaEccessiva = potenzaTotale > potenzaMassima;
      
      specificContainer.append(`
        <div class="col-md-4 mb-3 dimmer-column">
          <div class="card option-card dimmer-specific-card ${potenzaEccessiva ? 'disabled' : ''}" 
               data-dimmer="${dimmer}" 
               data-codice="${dimmerCode}" 
               data-potenza-max="${potenzaMassima}">
            <img src="${imgPath}" class="card-img-top" alt="${dimmerText}" 
                 style="height: 180px; object-fit: cover; ${potenzaEccessiva ? 'opacity: 0.5;' : ''}" 
                 onerror="this.src='/static/img/placeholder_logo.jpg'; this.style.height='180px'">
            <div class="card-body text-center">
              <h5 class="card-title">${dimmerText}</h5>
              ${spazioNonIlluminato ? `<p class="card-text small text-danger">Spazio non illuminato: ${spazioNonIlluminato}mm</p>` : ''}
            </div>
          </div>
        </div>
      `);
    });
  }

  $('#dimmer-specific-section').show();

  $('<style>').text(`
    .dimmer-specific-card.disabled {
      opacity: 0.7;
      cursor: not-allowed;
      border-color: #ddd !important;
    }
    .dimmer-specific-card.disabled:hover {
      transform: none;
      box-shadow: none;
    }
  `).appendTo('head');

  $('.dimmer-specific-card:not(.disabled)').on('click', function() {
    $('.dimmer-specific-card').removeClass('selected');
    $(this).addClass('selected');
    
    const dimmer = $(this).data('dimmer');
    configurazione.dimmerSelezionato = dimmer;
    configurazione.dimmerCodice = $(this).data('codice') || "";
    configurazione.dimmerPotenzaMax = $(this).data('potenza-max') || 0;

    if (dimmer.includes('DIMMER_TOUCH_SU_PROFILO_') || 
        dimmer.includes('PRFIRSW') || 
        dimmer.includes('PRFIRDIMM')) {
      $('#dimmer-warning').show();
      
      if (configurazione.lunghezzaRichiesta) {
        const spazioNonIlluminato = 50;
        $('#dimmer-warning').html(`
          <strong style="color:#ff0000 !important;">Nota:</strong> Con l'opzione Touch/IR su profilo ci sarà uno spazio non illuminato di ${spazioNonIlluminato}mm.
          Lunghezza illuminata effettiva: ${configurazione.lunghezzaRichiesta - spazioNonIlluminato}mm.
        `);
      }
    } else {
      $('#dimmer-warning').hide();
    }
    
    checkStep5Completion();
  });

  const dimmerAbilitati = $('.dimmer-specific-card:not(.disabled)');
  if (dimmerAbilitati.length === 1) {
    setTimeout(function() {
      dimmerAbilitati.click();
    }, 100);
  }
}

function bindDimmerCardListeners() {
  const potenzaTotale = calcolaPotenzaTotaleStrip();
  
  $('.dimmer-card').on('click', function() {
    const dimmer = $(this).data('dimmer');
    const potenzaMax = $(this).data('potenza-max') || 9999;

    if (potenzaTotale > potenzaMax) {
      alert(`Questo dimmer supporta fino a ${potenzaMax}W, ma la configurazione attuale richiede circa ${potenzaTotale.toFixed(1)}W. Seleziona un dimmer con potenza massima più elevata.`);
      return;
    }
    
    $('.dimmer-card').removeClass('selected');
    $(this).addClass('selected');
    
    configurazione.dimmerSelezionato = dimmer;
    configurazione.dimmerCodice = $(this).data('codice') || "";
    configurazione.dimmerPotenzaMax = potenzaMax;

    if (dimmer.includes('DIMMER_TOUCH_SU_PROFILO_') || 
        dimmer.includes('PRFIRSW') || 
        dimmer.includes('PRFIRDIMM')) {
      $('#dimmer-warning').show();
      
      if (configurazione.lunghezzaRichiesta) {
        const spazioNonIlluminato = 50;
        $('#dimmer-warning').html(`
          <strong style="color:#ff0000 !important;">Nota:</strong> Con l'opzione Touch/IR su profilo ci sarà uno spazio non illuminato di ${spazioNonIlluminato}mm.
          Lunghezza illuminata effettiva: ${configurazione.lunghezzaRichiesta - spazioNonIlluminato}mm.
        `);
      }
    } else {
      $('#dimmer-warning').hide();
    }
    
    checkStep5Completion();
  });
}

export function vaiAlControllo() {
  
  $('#profilo-nome-step5').text(configurazione.nomeModello);
  $('#tipologia-nome-step5').text(mappaTipologieVisualizzazione[configurazione.tipologiaSelezionata] || configurazione.tipologiaSelezionata);
  
  if (configurazione.stripLedSelezionata !== 'senza_strip' && configurazione.stripLedSelezionata !== 'NO_STRIP') {
    const nomeStripLed = configurazione.nomeCommercialeStripLed || 
                         mappaStripLedVisualizzazione[configurazione.stripLedSelezionata] || 
                         configurazione.stripLedSelezionata;
    
    $('#strip-nome-step5').text(nomeStripLed);
  } else {
    $('#strip-nome-step5').text('Senza Strip LED');
  }

  if (configurazione.tensioneSelezionato === '220V') {
    $('#alimentazione-nome-step5').text('Strip 220V (no alimentatore)');
  } else if (configurazione.alimentazioneSelezionata === 'SENZA_ALIMENTATORE') {
    $('#alimentazione-nome-step5').text('Senza alimentatore');
  } else {
    let alimentazioneText = configurazione.alimentazioneSelezionata === 'ON-OFF' ? 'ON-OFF' : 'Dimmerabile TRIAC';
    $('#alimentazione-nome-step5').text(alimentazioneText);
  }
  
  updateProgressBar(5);

  $("#step3-temperatura-potenza, #step4-alimentazione").fadeOut(300, function() {
    $("#step5-controllo").fadeIn(300, function() {
      if (configurazione.tensioneSelezionato === '220V') {
        configurazione.tipoAlimentazioneCavo = "ALIMENTAZIONE_UNICA";
        configurazione.lunghezzaCavoIngresso = 0;
        configurazione.lunghezzaCavoUscita = 0;
        configurazione.uscitaCavoSelezionata = "DRITTA";

        $('div.container.mb-5:has(h3:contains("Alimentazione Cavo"))').hide();
        $('div.container.mb-5:has(h3:contains("Lunghezza Cavo"))').hide();
        $('div.container.mb-5:has(h3:contains("Uscita Cavo"))').hide();

        const potenzaTotale = calcolaPotenzaTotaleStrip();
        
        const dimmerHtml = `
          <h3 class="mb-3">Dimmer</h3>
          <div class="alert alert-info mb-3">
            <strong>Nota:</strong> Per strip LED 220V sono disponibili le seguenti opzioni di dimmer.
          </div>
          <div class="row">
            <div class="col-md-6 mb-3 dimmer-column">
              <div class="card option-card dimmer-card" data-dimmer="DIMMERABILE_TRIAC_PULSANTE_TUYA_220V" data-codice="CTR130" data-potenza-max="200">
                <img src="/static/img/dimmer/dimmer_pulsante.jpg" class="card-img-top" alt="CTR130" style="height: 180px; object-fit: cover;" onerror="this.src='/static/img/placeholder_logo.jpg'; this.style.height='180px'">
                <div class="card-body text-center">
                  <h5 class="card-title">CTR130 - Dimmer a pulsante</h5>
                  <p class="card-text small text-muted">Dimmerabile TRIAC tramite pulsante e compatibile con sistema TUYA</p>
                  ${potenzaTotale > 200 ? '<p class="card-text small text-danger">Attenzione: Potenza richiesta superiore al limite massimo!</p>' : ''}
                </div>
              </div>
            </div>
            
            <div class="col-md-6 mb-3 dimmer-column">
              <div class="card option-card dimmer-card" data-dimmer="NESSUN_DIMMER">
                <div class="card-body text-center d-flex flex-column justify-content-center" style="min-height: 180px;">
                  <h5 class="card-title">Nessun dimmer</h5>
                  <p class="card-text small text-muted">Installazione senza controllo di luminosità</p>
                </div>
              </div>
            </div>
          </div>
        `;
        
        $('#dimmer-container').html(dimmerHtml);
        bindDimmerCardListeners();
      } else {
        prepareControlloListeners();
        
        if (configurazione.alimentazioneSelezionata === 'SENZA_ALIMENTATORE') {
          configurazione.dimmerSelezionato = "NESSUN_DIMMER";
          configurazione.dimmerCodice = "";
          
          $('#dimmer-container').parent().hide();
        } else {
          $('#dimmer-container').parent().show();
          caricaDimmerCompatibili();
        }
      }
      
      checkStep5Completion();
    });
  });
}

export function prepareControlloListeners() {
  configurazione.dimmerSelezionato = null;
  configurazione.tipoAlimentazioneCavo = null;
  configurazione.uscitaCavoSelezionata = "DRITTA";
  
  $('#dimmer-warning').hide();
  $('#lunghezza-cavo-uscita-container').hide();

  if (configurazione.tensioneSelezionato === '220V') {
    configurazione.tipoAlimentazioneCavo = "ALIMENTAZIONE_UNICA";
    configurazione.lunghezzaCavoIngresso = 0;
    configurazione.lunghezzaCavoUscita = 0;

    $('div.container.mb-5:has(h3:contains("Alimentazione Cavo"))').hide();
    $('div.container.mb-5:has(h3:contains("Lunghezza Cavo"))').hide();
    $('div.container.mb-5:has(h3:contains("Uscita Cavo"))').hide();
  } else {
    $('div.container.mb-5:has(h3:contains("Alimentazione Cavo"))').show();
    $('div.container.mb-5:has(h3:contains("Lunghezza Cavo"))').show();
    $('div.container.mb-5:has(h3:contains("Uscita Cavo"))').show();
    
    configurazione.tipoAlimentazioneCavo = null;
    $('#lunghezza-cavo-ingresso').val(0);
    $('#lunghezza-cavo-uscita').val(0);
    configurazione.lunghezzaCavoIngresso = 0;
    configurazione.lunghezzaCavoUscita = 0;
    
    $('.alimentazione-cavo-card, .uscita-cavo-card').removeClass('selected');
  }

  $('div.container.mb-5:has(h3:contains("Uscita Cavo"))').hide();
  
  $('#lunghezza-cavo-ingresso').val(0);
  $('#lunghezza-cavo-uscita').val(0);
  configurazione.lunghezzaCavoIngresso = 0;
  configurazione.lunghezzaCavoUscita = 0;
  
  $('#btn-continua-step5').prop('disabled', true);
  
  $('.alimentazione-cavo-card, .uscita-cavo-card').removeClass('selected');

  if (!configurazione.compatibilitaAlimentazioneDimmer) {
    if (configurazione.tensioneSelezionato === '220V') {
      configurazione.alimentazioneSelezionata = 'SENZA_ALIMENTATORE';
      configurazione.compatibilitaAlimentazioneDimmer = {
        'SENZA_ALIMENTATORE': ['NESSUN_DIMMER']
      };

      if (configurazione.stripLedSelezionata && 
          (configurazione.stripLedSelezionata.includes('RGB') || 
           configurazione.temperaturaColoreSelezionata === 'RGB' || 
           configurazione.temperaturaColoreSelezionata === 'RGBW')) {
        
        configurazione.compatibilitaAlimentazioneDimmer['SENZA_ALIMENTATORE'].push('CON_TELECOMANDO', 'CENTRALINA_TUYA');
      }
    } else {
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
    }
  }
  caricaDimmerCompatibili();

  const lunghezzaRichiesta = configurazione.lunghezzaRichiesta || 0;
  const alimentazioneCavoContainer = $('#alimentazione-cavo-container');
  alimentazioneCavoContainer.empty();

  if (configurazione.tensioneSelezionato === '24V' && lunghezzaRichiesta > 5000) {
    alimentazioneCavoContainer.html(`
      <div class="alert alert-warning mb-3">
        <strong>Nota:</strong> Per sistemi a 24V che superano i 5000mm di lunghezza è obbligatorio utilizzare l'alimentazione doppia.
      </div>
      <div class="row">
        <div class="col-md-4 mb-3">
          <div class="card option-card alimentazione-cavo-card" data-alimentazione-cavo="ALIMENTAZIONE_DOPPIA">
            <div class="card-body text-center">
              <h5 class="card-title">Alimentazione doppia</h5>
              <p class="card-text small text-muted">Due punti di alimentazione (obbligatorio per questa configurazione)</p>
            </div>
          </div>
        </div>
      </div>
    `);

    if ($('.alimentazione-cavo-card').length === 1) {
      $('.alimentazione-cavo-card').addClass('selected');
      configurazione.tipoAlimentazioneCavo = "ALIMENTAZIONE_DOPPIA";
      $('#lunghezza-cavo-uscita-container').show();
    } else {
      configurazione.tipoAlimentazioneCavo = null;
    }
    
  } else if (configurazione.tensioneSelezionato === '48V' && lunghezzaRichiesta <= 15000) {
    alimentazioneCavoContainer.html(`
      <div class="alert alert-info mb-3">
        <strong>Nota:</strong> Per sistemi a 48V fino a 15000mm di lunghezza è prevista solo l'alimentazione unica.
      </div>
      <div class="row">
        <div class="col-md-4 mb-3">
          <div class="card option-card alimentazione-cavo-card" data-alimentazione-cavo="ALIMENTAZIONE_UNICA">
            <div class="card-body text-center">
              <h5 class="card-title">Alimentazione unica</h5>
              <p class="card-text small text-muted">Singolo punto di alimentazione (consigliato per questa configurazione)</p>
            </div>
          </div>
        </div>
      </div>
    `);

    if ($('.alimentazione-cavo-card').length === 1) {
      $('.alimentazione-cavo-card').addClass('selected');
      configurazione.tipoAlimentazioneCavo = "ALIMENTAZIONE_UNICA";
      $('#lunghezza-cavo-uscita-container').hide();
    } else {
      configurazione.tipoAlimentazioneCavo = null;
    }
    
  } else if (configurazione.tensioneSelezionato === '220V') {
    alimentazioneCavoContainer.html(`
      <div class="alert alert-info mb-3">
        <strong>Nota:</strong> Per sistemi a 220V è prevista solo l'alimentazione unica senza limiti di lunghezza.
      </div>
      <div class="row">
        <div class="col-md-4 mb-3">
          <div class="card option-card alimentazione-cavo-card" data-alimentazione-cavo="ALIMENTAZIONE_UNICA">
            <div class="card-body text-center">
              <h5 class="card-title">Alimentazione unica</h5>
              <p class="card-text small text-muted">Singolo punto di alimentazione (obbligatorio per questa configurazione)</p>
            </div>
          </div>
        </div>
      </div>
    `);

    if ($('.alimentazione-cavo-card').length === 1) {
      $('.alimentazione-cavo-card').addClass('selected');
      configurazione.tipoAlimentazioneCavo = "ALIMENTAZIONE_UNICA";
      $('#lunghezza-cavo-uscita-container').hide();
    } else {
      configurazione.tipoAlimentazioneCavo = null;
    }
  }
    
  else {
    alimentazioneCavoContainer.html(`
      <div class="row">
        <div class="col-md-4 mb-3">
          <div class="card option-card alimentazione-cavo-card" data-alimentazione-cavo="ALIMENTAZIONE_UNICA">
            <div class="card-body text-center">
              <h5 class="card-title">Alimentazione unica</h5>
              <p class="card-text small text-muted">Singolo punto di alimentazione</p>
            </div>
          </div>
        </div>
        
        <div class="col-md-4 mb-3">
          <div class="card option-card alimentazione-cavo-card" data-alimentazione-cavo="ALIMENTAZIONE_DOPPIA">
            <div class="card-body text-center">
              <h5 class="card-title">Alimentazione doppia</h5>
              <p class="card-text small text-muted">Due punti di alimentazione</p>
            </div>
          </div>
        </div>
      </div>
    `);

    const alimentazioniCavoDisponibili = $('.alimentazione-cavo-card').length;
    if (alimentazioniCavoDisponibili === 1) {
      const $unicaAlimentazioneCavo = $('.alimentazione-cavo-card').first();
      $unicaAlimentazioneCavo.addClass('selected');
      configurazione.tipoAlimentazioneCavo = $unicaAlimentazioneCavo.data('alimentazione-cavo');

      if (configurazione.tipoAlimentazioneCavo === 'ALIMENTAZIONE_DOPPIA') {
        $('#lunghezza-cavo-uscita-container').show();
      } else {
        $('#lunghezza-cavo-uscita-container').hide();
      }
    } else {
      configurazione.tipoAlimentazioneCavo = null;
    }
  }

  $('.alimentazione-cavo-card').on('click', function() {
    $('.alimentazione-cavo-card').removeClass('selected');
    $(this).addClass('selected');
    
    const alimentazioneCavo = $(this).data('alimentazione-cavo');
    configurazione.tipoAlimentazioneCavo = alimentazioneCavo;
    
    if (alimentazioneCavo === 'ALIMENTAZIONE_DOPPIA') {
      $('#lunghezza-cavo-uscita-container').show();
    } else {
      $('#lunghezza-cavo-uscita-container').hide();
    }
    
    checkStep5Completion();
  });

  $('.uscita-cavo-card').on('click', function() {
    $('.uscita-cavo-card').removeClass('selected');
    $(this).addClass('selected');
    
    configurazione.uscitaCavoSelezionata = $(this).data('uscita-cavo');
    
    checkStep5Completion();
  });

  $('#lunghezza-cavo-ingresso').on('input change', function() {
    const valore = parseInt($(this).val()) || 0;
    configurazione.lunghezzaCavoIngresso = valore;
    checkStep5Completion();
  });
  
  $('#lunghezza-cavo-uscita').on('input change', function() {
    const valore = parseInt($(this).val()) || 0;
    configurazione.lunghezzaCavoUscita = valore;
    checkStep5Completion();
  });
}