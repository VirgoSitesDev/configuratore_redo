import { configurazione, mappaCategorieVisualizzazione } from '../config.js';
import { updateProgressBar } from '../utils.js';
import { caricaOpzioniProfilo, caricaFinitureDisponibili } from '../api.js';

export function initStep2EsterniListeners() {
    $('#btn-torna-step2-esterni').on('click', function(e) {
        e.preventDefault();
        $("#step2-modello-esterni").fadeOut(300, function() {
            $("#step3-temperatura-potenza").fadeIn(300);
            updateProgressBar(3);
        });
    });
    
    $('#btn-continua-step2-esterni').on('click', function(e) {
        e.preventDefault();
        if (configurazione.profiloSelezionato) {
            $('#tipologie-options').empty().html('<div class="text-center mt-3"><div class="spinner-border" role="status"></div><p class="mt-3">Caricamento opzioni...</p></div>');
            
            caricaOpzioniProfilo(configurazione.profiloSelezionato);

            $("#step2-modello-esterni").fadeOut(300, function() {
                setTimeout(() => {
                    if ($('.tipologia-card').length === 1 && $('.tipologia-card').data('id') === 'taglio_misura') {
                        $('.tipologia-card').click();
                        configurazione.tipologiaSelezionata = 'taglio_misura';
                        
                        // Nascondi completamente la sezione modello prima di andare alla personalizzazione
                        $("#step2-modello").hide();
                        
                        import('./step2.js').then(module => {
                            module.vaiAllaPersonalizzazione();
                        });
                    } else {
                        $("#step2-modello").fadeIn(300);
                        updateProgressBar(4);
                        
                        // Aggiungi listener per la selezione della tipologia nel flusso esterni
                        $('.tipologia-card').off('click.esterni').on('click.esterni', function() {
                            $('.tipologia-card').removeClass('selected');
                            $(this).addClass('selected');
                            configurazione.tipologiaSelezionata = $(this).data('id');
                            
                            // Nascondi la sezione modello e vai alla personalizzazione
                            $("#step2-modello").fadeOut(300, function() {
                                import('./step2.js').then(module => {
                                    module.vaiAllaPersonalizzazione();
                                });
                            });
                        });
                    }
                }, 500);
            });
        }
    });
}

export function vaiAllaSelezioneProfiliPerEsterni() {
    console.log('=== DEBUG: vaiAllaSelezioneProfiliPerEsterni chiamata ===');
    console.log('Categoria selezionata:', configurazione.categoriaSelezionata);
    console.log('Strip LED selezionata:', configurazione.stripLedSelezionata);
    console.log('Nome commerciale strip:', configurazione.nomeCommercialeStripLed);
    console.log('Strip LED scelta finale:', configurazione.stripLedSceltaFinale);

    // Assicurati che il flusso esterni sia ancora attivo
    if (!configurazione.isFlussoProfiliEsterni) {
        console.warn('ATTENZIONE: flusso profili esterni non attivo!');
        configurazione.isFlussoProfiliEsterni = true;
    }

    $(".step-section").hide();
    $("#step2-modello-esterni").fadeIn(300);
    updateProgressBar(4);

    $('#categoria-nome-step2-modello-esterni').text(
        mappaCategorieVisualizzazione[configurazione.categoriaSelezionata] || configurazione.categoriaSelezionata
    );
    $('#strip-configurata-esterni').text(
        configurazione.nomeCommercialeStripLed || configurazione.stripLedSelezionata || 'Strip LED configurata'
    );

    console.log('Chiamata caricaProfiliCompatibiliConStrip...');
    caricaProfiliCompatibiliConStrip();
}

export function caricaProfiliCompatibiliConStrip() {
    console.log('=== DEBUG: caricaProfiliCompatibiliConStrip ===');
    console.log('Categoria:', configurazione.categoriaSelezionata);
    console.log('Strip LED per filtro:', configurazione.stripLedSelezionata);

    $('#profili-esterni-container').empty().html(
        '<div class="text-center mt-5"><div class="spinner-border" role="status"></div><p class="mt-3">Caricamento profili compatibili...</p></div>'
    );

    // Rimuovi tutti i listener precedenti per evitare conflitti
    $(document).off('click', '.profilo-card-esterni');

    $.ajax({
        url: `/get_profili/${configurazione.categoriaSelezionata}`,
        method: 'GET',
        success: function(data) {
            console.log('Profili ricevuti dal server:', data.length);
            console.log('Lista completa profili ricevuti:');
            data.forEach((profilo, index) => {
                console.log(`${index}: ${profilo.id || profilo.nome} - Strip compatibili:`, profilo.stripLedCompatibili);
            });
            
            $('#profili-esterni-container').empty();
            
            if (!data || data.length === 0) {
                $('#profili-esterni-container').html(
                    '<div class="col-12 text-center"><p>Nessun profilo disponibile per questa categoria.</p></div>'
                );
                return;
            }

            const profiliCompatibili = filtraProfiliPerStripSelezionata(data);
            console.log('Profili compatibili dopo filtro:', profiliCompatibili.length);
            
            if (profiliCompatibili.length === 0) {
                $('#profili-esterni-container').html(
                    '<div class="col-12 text-center"><p>Nessun profilo compatibile con la strip LED configurata.</p><p class="small text-muted">ID Strip cercato: ' + configurazione.stripLedSelezionata + '</p></div>'
                );
                return;
            }

            // Mostra i profili compatibili
            let grid = $('<div class="row"></div>');
            $('#profili-esterni-container').append(grid);
            
            profiliCompatibili.forEach(function(profilo) {
                const profiloId = profilo.id || 'unknown';
                const profiloNome = profilo.nome || 'Profilo senza nome';
                
                let profiloCard = $(`
                    <div class="col-md-4 col-sm-6 mb-4 profilo-card-row">
                        <div class="card profilo-card-esterni" 
                             data-id="${profiloId}" 
                             data-nome="${profiloNome}"
                             style="cursor: pointer;">
                            <img src="${profilo.immagine || '/static/img/placeholder_logo.jpg'}" 
                                 class="card-img-top" alt="${profiloNome}" 
                                 onerror="this.src='/static/img/placeholder_logo.jpg'">
                            <div class="card-body">
                                <h5 class="card-title">${profiloNome}</h5>
                                <p class="card-text small text-muted">Compatibile con la tua strip LED</p>
                            </div>
                        </div>
                    </div>
                `);
                
                grid.append(profiloCard);
            });

            // Aggiungi il listener per la selezione del profilo
            $(document).on('click', '.profilo-card-esterni', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const $card = $(this);
                const id = $card.data('id');
                const nome = $card.data('nome');

                console.log('Profilo selezionato:', id, nome);

                $('.profilo-card-esterni').removeClass('selected');
                $card.addClass('selected');
                configurazione.profiloSelezionato = id;
                configurazione.nomeModello = nome;

                $('#btn-continua-step2-esterni').prop('disabled', false);
            });

            // Se c'è solo un profilo compatibile, selezionalo automaticamente
            if (profiliCompatibili.length === 1) {
                setTimeout(() => {
                    $('.profilo-card-esterni').first().click();
                }, 500);
            }
        },
        error: function(error) {
            console.error("Errore nel caricamento dei profili:", error);
            $('#profili-esterni-container').html(
                '<div class="col-12 text-center"><p class="text-danger">Errore nel caricamento dei profili. Riprova più tardi.</p></div>'
            );
        }
    });
}

function filtraProfiliPerStripSelezionata(profili) {
    const stripSelezionata = configurazione.stripLedSelezionata || configurazione.stripLedSceltaFinale;
    
    console.log('Filtro profili per strip:', stripSelezionata);
    console.log('=== ANALISI DETTAGLIATA COMPATIBILITÀ ===');

    if (!stripSelezionata || stripSelezionata === 'NO_STRIP') {
        console.log('Nessuna strip selezionata, ritorno tutti i profili');
        return profili;
    }
    
    const profiliCompatibili = profili.filter((profilo, index) => {
        console.log(`\nProfilo ${index}: ${profilo.nome || profilo.id}`);
        console.log('Strip compatibili (array completo):', profilo.stripLedCompatibili);
        
        if (!profilo.stripLedCompatibili || profilo.stripLedCompatibili.length === 0) {
            console.log(`❌ Profilo ${profilo.nome}: nessuna strip compatibile definita`);
            return false;
        }
        
        // Debug ogni elemento dell'array
        profilo.stripLedCompatibili.forEach((strip, i) => {
            console.log(`  [${i}]: "${strip}" ${strip === stripSelezionata ? '✅ MATCH!' : ''}`);
        });
        
        // Verifica se la strip selezionata è nell'array
        const isCompatibile = profilo.stripLedCompatibili.includes(stripSelezionata);
        console.log(`Risultato compatibilità per ${profilo.nome}: ${isCompatibile ? '✅' : '❌'}`);
        
        return isCompatibile;
    });
    
    console.log('\n=== RISULTATO FINALE ===');
    console.log('Profili compatibili trovati:', profiliCompatibili.length);
    console.log('Profili compatibili:', profiliCompatibili.map(p => p.nome || p.id));
    
    return profiliCompatibili;
}