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

                        $("#step2-modello").hide();
                        
                        import('./step2.js').then(module => {
                            module.vaiAllaPersonalizzazione();
                        });
                    } else {
                        $("#step2-modello").fadeIn(300);
                        updateProgressBar(4);
                        $('.tipologia-card').off('click.esterni').on('click.esterni', function() {
                            $('.tipologia-card').removeClass('selected');
                            $(this).addClass('selected');
                            configurazione.tipologiaSelezionata = $(this).data('id');
                            $('#btn-continua-step2').prop('disabled', false);
                        });

                        $('#btn-continua-step2').off('click.esterni').on('click.esterni', function(e) {
                            e.preventDefault();
                            if (configurazione.tipologiaSelezionata) {
                                $("#step2-modello").fadeOut(300, function() {
                                    import('./step2.js').then(module => {
                                        module.vaiAllaPersonalizzazione();
                                    });
                                });
                            }
                        });
                    }
                }, 500);
            });
        }
    });
}

export function vaiAllaSelezioneProfiliPerEsterni() {
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
    caricaProfiliCompatibiliConStrip();
}

export function caricaProfiliCompatibiliConStrip() {
    $('#profili-esterni-container').empty().html(
        '<div class="text-center mt-5"><div class="spinner-border" role="status"></div><p class="mt-3">Caricamento profili compatibili...</p></div>'
    );

    $(document).off('click', '.profilo-card-esterni');

    $.ajax({
        url: `/get_profili/${configurazione.categoriaSelezionata}`,
        method: 'GET',
        success: function(data) {
            $('#profili-esterni-container').empty();
            
            if (!data || data.length === 0) {
                $('#profili-esterni-container').html(
                    '<div class="col-12 text-center"><p>Nessun profilo disponibile per questa categoria.</p></div>'
                );
                return;
            }

            const profiliCompatibili = filtraProfiliPerStripSelezionata(data);
            
            if (profiliCompatibili.length === 0) {
                $('#profili-esterni-container').html(
                    '<div class="col-12 text-center"><p>Nessun profilo compatibile con la strip LED configurata.</p><p class="small text-muted">ID Strip cercato: ' + configurazione.stripLedSelezionata + '</p></div>'
                );
                return;
            }

            let grid = $('<div class="row"></div>');
            $('#profili-esterni-container').append(grid);
            
            profiliCompatibili.forEach(function(profilo) {
                const profiloId = profilo.id || 'unknown';
                const profiloNome = profilo.nome || 'Profilo senza nome';
                const descrizione = profilo.note ? `<p class="card-text text-muted small mb-0">${profilo.note}</p>` : '';

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
                                ${descrizione}
                                <p class="card-text small text-muted">Compatibile con la tua strip LED</p>
                            </div>
                        </div>
                    </div>
                `);

                grid.append(profiloCard);
            });

            $(document).on('click', '.profilo-card-esterni', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const $card = $(this);
                const id = $card.data('id');
                const nome = $card.data('nome');

                $('.profilo-card-esterni').removeClass('selected');
                $card.addClass('selected');
                configurazione.profiloSelezionato = id;
                configurazione.nomeModello = nome;

                $('#btn-continua-step2-esterni').prop('disabled', false);
            });

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

    if (!stripSelezionata || stripSelezionata === 'NO_STRIP') {
        return profili;
    }
    
    const profiliCompatibili = profili.filter((profilo, index) => {
        if (!profilo.stripLedCompatibili || profilo.stripLedCompatibili.length === 0) {
            return false;
        }
        const isCompatibile = profilo.stripLedCompatibili.includes(stripSelezionata);
        return isCompatibile;
    });
    return profiliCompatibili;
}