from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import os
import json
from database import DatabaseManager
from datetime import datetime
import tempfile
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import logging

app = Flask(__name__)
CORS(app)

db = DatabaseManager()
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_categorie')
def get_categorie():
    try:
        categorie = db.get_categorie()
        return jsonify(categorie)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get_profili/<categoria>')
def get_profili(categoria):
    try:
        profili = db.get_profili_by_categoria(categoria)

        tutti_strip_ids = set()
        for profilo in profili:
            strip_ids = profilo.get('stripLedCompatibili', [])
            tutti_strip_ids.update(strip_ids)

        strip_led_map = {}
        if tutti_strip_ids:
            strip_ids_list = list(tutti_strip_ids)

            strip_data_response = db.supabase.table('strip_led')\
                .select('id, nome_commerciale')\
                .in_('id', strip_ids_list)\
                .execute()

            if strip_data_response.data:
                for strip in strip_data_response.data:
                    strip_led_map[strip['id']] = {
                        'id': strip['id'],
                        'nomeCommerciale': strip.get('nome_commerciale', '')
                    }

        for profilo in profili:
            strip_compatibili_info = []
            for strip_id in profilo.get('stripLedCompatibili', []):
                if strip_id in strip_led_map:
                    strip_compatibili_info.append(strip_led_map[strip_id])
            profilo['stripLedCompatibiliInfo'] = strip_compatibili_info
        
        return jsonify(profili)
    except Exception as e:
        logging.error(f"Errore in get_profili: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/get_opzioni_profilo/<profilo_id>')
def get_opzioni_profilo(profilo_id):
    try:
        profilo_data = db.supabase.table('profili').select('*').eq('id', profilo_id).single().execute().data
        
        if not profilo_data:
            return jsonify({'tipologie': []})
            
        tipologie = db.supabase.table('profili_tipologie').select('tipologia').eq('profilo_id', profilo_id).execute().data
        
        return jsonify({
            'tipologie': [t['tipologia'] for t in tipologie]
        })
    except Exception as e:
        return jsonify({'tipologie': []})

@app.route('/get_opzioni_tensione/<profilo_id>')
@app.route('/get_opzioni_tensione/<profilo_id>/<tipologia_strip>')
def get_opzioni_tensione(profilo_id, tipologia_strip=None):
    try:
        if profilo_id == 'ESTERNI':
            voltaggi_disponibili = ['24V', '48V', '220V']
            if tipologia_strip == 'SPECIAL':
                voltaggi_disponibili = ['24V']
            return jsonify({'success': True, 'voltaggi': voltaggi_disponibili})
        
        strip_compatibili = db.supabase.table('profili_strip_compatibili').select('strip_id').eq('profilo_id', profilo_id).execute().data
        strip_ids = [s['strip_id'] for s in strip_compatibili]
        
        if not strip_ids:
            return jsonify({'success': True, 'voltaggi': []})
        
        query = db.supabase.table('strip_led').select('tensione')
        
        if tipologia_strip:
            query = query.eq('tipo', tipologia_strip)
        
        strips = query.in_('id', strip_ids).execute().data
        
        voltaggi_disponibili = list(set([s['tensione'] for s in strips]))
        
        return jsonify({'success': True, 'voltaggi': voltaggi_disponibili})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_opzioni_ip/<profilo_id>/<tensione>')
@app.route('/get_opzioni_ip/<profilo_id>/<tensione>/<tipologia_strip>')
def get_opzioni_ip(profilo_id, tensione, tipologia_strip=None):
    try:
        strip_compatibili = db.supabase.table('profili_strip_compatibili').select('strip_id').eq('profilo_id', profilo_id).execute().data
        strip_ids = [s['strip_id'] for s in strip_compatibili]
        
        if not strip_ids:
            return jsonify({'success': True, 'ip': []})
        
        query = db.supabase.table('strip_led').select('ip').eq('tensione', tensione)
        
        if tipologia_strip:
            query = query.eq('tipo', tipologia_strip)
        
        strips = query.in_('id', strip_ids).execute().data
        
        ip_disponibili = list(set([s['ip'] for s in strips]))
        
        return jsonify({'success': True, 'ip': ip_disponibili})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_opzioni_temperatura_iniziale/<profilo_id>/<tensione>/<ip>')
@app.route('/get_opzioni_temperatura_iniziale/<profilo_id>/<tensione>/<ip>/<tipologia_strip>')
def get_opzioni_temperatura_iniziale(profilo_id, tensione, ip, tipologia_strip=None):
    try:
        strip_compatibili = db.supabase.table('profili_strip_compatibili').select('strip_id').eq('profilo_id', profilo_id).execute().data
        strip_ids = [s['strip_id'] for s in strip_compatibili]
        
        if not strip_ids:
            return jsonify({'success': True, 'temperature': []})
        
        query = db.supabase.table('strip_led').select('id').eq('tensione', tensione).eq('ip', ip)
        
        if tipologia_strip:
            query = query.eq('tipo', tipologia_strip)
        
        strips = query.in_('id', strip_ids).execute().data
        
        temperature_disponibili = set()
        for strip in strips:
            temps = db.supabase.table('strip_temperature').select('temperatura').eq('strip_id', strip['id']).execute().data
            for t in temps:
                temperature_disponibili.add(t['temperatura'])
        
        return jsonify({'success': True, 'temperature': list(temperature_disponibili)})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_temperature_colore/<profilo_id>/<tipologia>/<tensione>/<ip>')
def get_temperature_colore(profilo_id, tipologia, tensione, ip):
    try:
        strips = db.get_strip_led_filtrate(profilo_id, tensione, ip, None, None, tipologia)
        
        temperature = set()
        for strip in strips:
            for temp in strip.get('temperaturaColoreDisponibili', []):
                temperature.add(temp)
        
        temperature_list = list(temperature)
        temperature_list.sort()
        
        return jsonify({'success': True, 'temperature': temperature_list})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_opzioni_potenza/<profilo_id>/<tensione>/<ip>/<temperatura>')
@app.route('/get_opzioni_potenza/<profilo_id>/<tensione>/<ip>/<temperatura>/<tipologia_strip>')
def get_opzioni_potenza(profilo_id, tensione, ip, temperatura, tipologia_strip=None):
    try:
        # AGGIUNGI QUESTO LOG
        logging.info(f"get_opzioni_potenza chiamata con: profilo_id={profilo_id}, tensione={tensione}, ip={ip}, temperatura={temperatura}, tipologia_strip={tipologia_strip}")
        
        # Per gli esterni, cerca tutte le strip senza filtrare per profilo
        if profilo_id == 'ESTERNI':
            strips = db.get_all_strip_led_filtrate(tensione, ip, temperatura, None, tipologia_strip)
        else:
            strips = db.get_strip_led_filtrate(profilo_id, tensione, ip, temperatura, None, tipologia_strip)
        
        tutte_potenze_disponibili = set()
        for strip in strips:
            tutte_potenze_disponibili.update(strip.get('potenzeDisponibili', []))
        
        if not tutte_potenze_disponibili:
            return jsonify({'success': False, 'message': 'Nessuna potenza disponibile per i parametri selezionati'})
        
        potenze_complete = []
        for potenza in tutte_potenze_disponibili:
            potenze_complete.append({
                'id': potenza,
                'nome': potenza,
                'codice': '',
                'specifiche': ''
            })
        
        return jsonify({'success': True, 'potenze': potenze_complete})
    except Exception as e:
        logging.error(f"Errore in get_opzioni_potenza: {str(e)}")
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_strip_led_filtrate/<profilo_id>/<tensione>/<ip>/<temperatura>/<potenza>')
@app.route('/get_strip_led_filtrate/<profilo_id>/<tensione>/<ip>/<temperatura>/<potenza>/<tipologia>')
def get_strip_led_filtrate(profilo_id, tensione, ip, temperatura, potenza, tipologia=None):
    try:
        if potenza:
            potenza = potenza.replace('-', ' ').replace('_', '/')
        
        # Per gli esterni, cerca tutte le strip senza filtrare per profilo
        if profilo_id == 'ESTERNI':
            strips = db.get_all_strip_led_filtrate(tensione, ip, temperatura, potenza, tipologia)
        else:
            strips = db.get_strip_led_filtrate(profilo_id, tensione, ip, temperatura, potenza, tipologia)
        
        return jsonify({'success': True, 'strip_led': strips})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})
    
@app.route('/get_opzioni_temperatura_filtrate_esterni/<tensione>/<ip>/<tipologia>')
def get_opzioni_temperatura_filtrate_esterni(tensione, ip, tipologia):
    try:
        # Prima ottieni tutte le strip con tensione, IP e tipologia
        query = db.supabase.table('strip_led').select('id')\
            .eq('tensione', tensione)\
            .eq('ip', ip)
        
        if tipologia and tipologia != 'None':
            query = query.eq('tipo', tipologia)
        
        strips = query.execute().data
        
        if not strips:
            return jsonify({'success': True, 'temperature': []})
        
        strip_ids = [s['id'] for s in strips]
        
        # Ora ottieni tutte le temperature disponibili per queste strip
        temperature_data = db.supabase.table('strip_temperature')\
            .select('temperatura')\
            .in_('strip_id', strip_ids)\
            .execute().data
        
        # Estrai temperature uniche
        temperature_uniche = list(set([t['temperatura'] for t in temperature_data]))
        
        # Ordina le temperature
        temperature_ordinate = sorted(temperature_uniche, key=lambda t: (
            0 if 'K' in t and t.replace('K', '').isdigit() else 1,
            int(t.replace('K', '')) if 'K' in t and t.replace('K', '').isdigit() else 0,
            2 if t == 'CCT' else 3 if t == 'RGB' else 4 if t == 'RGBW' else 5,
            t
        ))
        
        return jsonify({
            'success': True,
            'temperature': temperature_ordinate,
            'debug': {
                'strips_trovate': len(strips),
                'temperature_trovate': len(temperature_ordinate)
            }
        })
        
    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'message': str(e),
            'traceback': traceback.format_exc()
        })

@app.route('/get_opzioni_alimentatore/<tipo_alimentazione>/<tensione_strip>')
@app.route('/get_opzioni_alimentatore/<tipo_alimentazione>/<tensione_strip>/<int:potenza_consigliata>')
def get_opzioni_alimentatore(tipo_alimentazione, tensione_strip, potenza_consigliata=None):
    try:
        alimentatori = db.get_alimentatori_by_tipo(tipo_alimentazione, tensione_strip)
        
        if potenza_consigliata:
            alimentatori_filtrati = []
            for alim in alimentatori:
                potenze_adatte = [p for p in alim.get('potenze', []) if p >= potenza_consigliata]
                if potenze_adatte:
                    alim['potenza_consigliata'] = min(potenze_adatte)
                    alimentatori_filtrati.append(alim)
        else:
            alimentatori_filtrati = alimentatori
        
        dettagli_alimentatori = {alim['id']: alim for alim in alimentatori}
        
        return jsonify({
            'success': True,
            'alimentatori': alimentatori_filtrati,
            'dettagliAlimentatori': dettagli_alimentatori
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_potenze_alimentatore/<alimentatore_id>')
def get_potenze_alimentatore(alimentatore_id):
    try:
        potenze = db.get_potenze_alimentatore(alimentatore_id)
        return jsonify({'success': True, 'potenze': potenze})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_dettagli_alimentatore/<alimentatore_id>')
def get_dettagli_alimentatore(alimentatore_id):
    try:
        alimentatore = db.get_dettagli_alimentatore(alimentatore_id)
        
        if alimentatore:
            return jsonify({'success': True, 'alimentatore': alimentatore})
        else:
            return jsonify({'success': False, 'message': 'Alimentatore non trovato'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_opzioni_dimmerazione/<strip_id>')
def get_opzioni_dimmerazione(strip_id):
    try:
        result = db.get_dimmer_compatibili(strip_id)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_dimmer_compatibili/<strip_id>')
def get_dimmer_compatibili(strip_id):
    try:
        result = db.get_dimmer_compatibili(strip_id)
        dimmer_compatibili = [d for d in result.get('opzioni', []) if d != 'NESSUN_DIMMER']
        return jsonify({'success': True, 'dimmer_compatibili': dimmer_compatibili})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_finiture/<profilo_id>')
def get_finiture(profilo_id):
    try:
        finiture = db.supabase.table('profili_finiture').select('finitura').eq('profilo_id', profilo_id).execute().data
        finiture_list = [f['finitura'] for f in finiture]
        
        mappatura_finiture = {
            'ALLUMINIO_ANODIZZATO': 'Alluminio anodizzato',
            'BIANCO': 'Bianco',
            'NERO': 'Nero',
            'ALLUMINIO': 'Alluminio'
        }
        
        finiture_formattate = [
            {
                'id': finitura,
                'nome': mappatura_finiture.get(finitura, finitura)
            }
            for finitura in finiture_list
        ]
        
        return jsonify({'success': True, 'finiture': finiture_formattate})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/calcola_potenza_alimentatore', methods=['POST'])
def calcola_potenza_alimentatore():
    data = request.json
    potenza_per_metro = data.get('potenzaPerMetro', 0)
    lunghezza_metri = data.get('lunghezzaMetri', 0)
    potenza_totale = potenza_per_metro * lunghezza_metri * 1.2
    potenze_standard = [30, 60, 100, 150, 200, 320]
    potenza_consigliata = next((p for p in potenze_standard if p >= potenza_totale), potenze_standard[-1])
    
    return jsonify({
        'success': True,
        'potenzaTotale': round(potenza_totale, 2),
        'potenzaConsigliata': potenza_consigliata
    })

@app.route('/calcola_potenza_consigliata', methods=['POST'])
def calcola_potenza_consigliata():
    try:
        data = request.json
        
        potenza_strip = float(data.get('potenzaStrip', 0))
        lunghezza = float(data.get('lunghezza', 0))
        alimentazione_doppia = data.get('alimentazioneDoppia', False)
        
        potenza_totale = (potenza_strip * lunghezza) / 1000
        
        if alimentazione_doppia:
            potenza_totale = potenza_totale / 2
        
        potenza_consigliata = potenza_totale * 1.2
        potenza_consigliata = int((potenza_consigliata + 4) / 5) * 5
        
        return jsonify({
            'success': True,
            'potenzaConsigliata': potenza_consigliata,
            'potenzaTotale': potenza_totale
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/calcola_lunghezze', methods=['POST'])
def calcola_lunghezze():
    data = request.json
    dim_richiesta = data.get('lunghezzaRichiesta', 0)
    strip_id = data.get('stripLedSelezionata')
    potenza_selezionata = data.get('potenzaSelezionata')
    lunghezze_multiple = data.get('lunghezzeMultiple', {})
    forma_taglio = data.get('formaDiTaglioSelezionata', 'DRITTO_SEMPLICE')
    
    taglio_minimo = 1
    spazio_produzione = 5

    if strip_id and strip_id != 'NO_STRIP' and potenza_selezionata:
        strip_data = db.supabase.table('strip_led').select('*').eq('id', strip_id).single().execute()
        if strip_data.data:
            strip_info = strip_data.data
            tagli_minimi = strip_info.get('taglio_minimo', [])

            potenze_data = db.supabase.table('strip_potenze').select('*').eq('strip_id', strip_id).order('indice').execute()
            if potenze_data.data:
                indice_potenza = -1
                for record in potenze_data.data:
                    if record.get('potenza') == potenza_selezionata:
                        indice_potenza = record.get('indice', -1)
                        break

                if indice_potenza >= 0 and indice_potenza < len(tagli_minimi):
                    taglio_minimo_str = tagli_minimi[indice_potenza]
                    import re
                    match = re.search(r'(\d+(?:[.,]\d+)?)', taglio_minimo_str)
                    if match:
                        taglio_minimo_val = match.group(1).replace(',', '.')
                        try:
                            taglio_minimo = float(taglio_minimo_val)
                        except ValueError:
                            pass

    def calcola_proposte_singole(lunghezza):
        if lunghezza > 0:
            proposta1 = int((lunghezza - 5) // taglio_minimo * taglio_minimo) + 5
            proposta2 = int((((lunghezza - 5) + taglio_minimo - 0.01) // taglio_minimo) * taglio_minimo) + 5

            if proposta2 <= proposta1:
                proposta2 = int(proposta1 + taglio_minimo)
        else:
            proposta1 = 0
            proposta2 = 0
        
        return proposta1, proposta2

    def calcola_spazio_buio_lato(valore_originale, proposta1, proposta2):
        if valore_originale == proposta1 or valore_originale == proposta2:
            return 0

        if proposta1 < valore_originale < proposta2:
            return valore_originale - proposta1

        if valore_originale < proposta1:
            return 0

        if valore_originale > proposta2:
            return valore_originale - proposta2
        
        return 0

    if forma_taglio != 'DRITTO_SEMPLICE' and lunghezze_multiple:
        proposte_per_lato = {}
        
        for lato, lunghezza in lunghezze_multiple.items():
            if lunghezza and lunghezza > 0:
                prop1, prop2 = calcola_proposte_singole(lunghezza)
                proposte_per_lato[lato] = {
                    'originale': lunghezza,
                    'proposta1': prop1,
                    'proposta2': prop2
                }

        import itertools
        
        lati_ordinati = sorted(proposte_per_lato.keys())
        combinazioni = []
        opzioni_per_lato = []
        for lato in lati_ordinati:
            opzioni = []
            props = proposte_per_lato[lato]
            
            if props['proposta1'] != props['originale']:
                opzioni.append(('proposta1', props['proposta1']))
            
            if props['proposta2'] != props['originale'] and props['proposta2'] != props['proposta1']:
                opzioni.append(('proposta2', props['proposta2']))
            
            opzioni.append(('originale', props['originale']))
            opzioni_per_lato.append(opzioni)

        for combinazione in itertools.product(*opzioni_per_lato):
            combo_dict = {}
            combo_label_parts = []
            lunghezza_totale = 0
            spazio_buio_totale = 0
            
            for i, (tipo, valore) in enumerate(combinazione):
                lato = lati_ordinati[i]
                combo_dict[lato] = valore
                lunghezza_totale += valore

                props = proposte_per_lato[lato]
                spazio_buio_lato = calcola_spazio_buio_lato(
                    props['originale'], 
                    props['proposta1'], 
                    props['proposta2']
                ) if tipo == 'originale' else 0
                
                spazio_buio_totale += spazio_buio_lato

                if tipo == 'originale':
                    combo_label_parts.append(f"Orig.")
                elif tipo == 'proposta1':
                    combo_label_parts.append(f"Prop.1")
                else:
                    combo_label_parts.append(f"Prop.2")
            
            combinazioni.append({
                'lunghezze': combo_dict,
                'lunghezza_totale': lunghezza_totale,
                'label': " + ".join(combo_label_parts),
                'ha_spazio_buio': spazio_buio_totale > 0,
                'spazio_buio_totale': spazio_buio_totale,
                'dettaglio': combinazione
            })

        combinazioni.sort(key=lambda x: (x['ha_spazio_buio'], x['spazio_buio_totale'], x['lunghezza_totale']))
        
        return jsonify({
            'success': True,
            'tipo': 'combinazioni',
            'spazioProduzione': spazio_produzione,
            'proposte_per_lato': proposte_per_lato,
            'combinazioni': combinazioni[:27]
        })
    
    else:
        if dim_richiesta > 0:
            proposta1, proposta2 = calcola_proposte_singole(dim_richiesta)
        else:
            proposta1 = 0
            proposta2 = 0
        
        return jsonify({
            'success': True,
            'tipo': 'semplice',
            'spazioProduzione': spazio_produzione,
            'proposte': {
                'proposta1': proposta1,
                'proposta2': proposta2
            }
        })

@app.route('/finalizza_configurazione', methods=['POST'])
def finalizza_configurazione():
    configurazione = request.json
    
    potenza_per_metro = 0
    if 'potenzaSelezionata' in configurazione and configurazione['potenzaSelezionata']:
        potenza_str = configurazione['potenzaSelezionata'].split('W/m')[0]
        try:
            potenza_per_metro = float(potenza_str)
        except ValueError:
            potenza_per_metro = 0
    
    lunghezza_in_metri = 0
    if 'lunghezzaRichiesta' in configurazione and configurazione['lunghezzaRichiesta']:
        try:
            lunghezza_in_metri = float(configurazione['lunghezzaRichiesta']) / 1000
        except ValueError:
            lunghezza_in_metri = 0
    
    potenza_totale = potenza_per_metro * lunghezza_in_metri
    
    profilo = configurazione.get('profiloSelezionato', '')
    strip = configurazione.get('stripLedSelezionata', '')
    temperatura = configurazione.get('temperaturaColoreSelezionata', '')
    
    codice_prodotto = profilo
    
    return jsonify({
        'success': True,
        'riepilogo': configurazione,
        'potenzaTotale': round(potenza_totale, 2),
        'codiceProdotto': codice_prodotto
    })

@app.route('/salva_configurazione', methods=['POST'])
def salva_configurazione():
    try:
        data = request.json
        
        saved = db.salva_configurazione(
            configurazione=data.get('configurazione'),
            codice_prodotto=data.get('codice_prodotto'),
            email=data.get('email'),
            telefono=data.get('telefono'),
            note=data.get('note')
        )
        
        if saved:
            try:
                excel_path = genera_excel_configurazione(
                    data.get('configurazione'),
                    data.get('codice_prodotto')
                )
                
                return jsonify({
                    'success': True,
                    'id': saved['id'],
                    'message': 'Configurazione salvata con successo',
                    'excel_path': excel_path
                })
            except Exception as excel_error:
                return jsonify({
                    'success': True,
                    'id': saved['id'],
                    'message': 'Configurazione salvata (errore generazione Excel)',
                    'error_detail': str(excel_error)
                })
        
        return jsonify({'success': False, 'message': 'Errore nel salvataggio'})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/download_excel/<filename>')
def download_excel(filename):
    try:
        filepath = os.path.join(tempfile.gettempdir(), filename)
        return send_file(
            filepath,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 404

def genera_excel_configurazione(configurazione, codice_prodotto):
    wb = Workbook()
    ws = wb.active
    ws.title = "Configurazione REDO"
    
    header_font = Font(bold=True, size=14, color="FFFFFF")
    header_fill = PatternFill(start_color="E83F34", end_color="E83F34", fill_type="solid")
    
    subheader_font = Font(bold=True, size=12)
    subheader_fill = PatternFill(start_color="F0F0F0", end_color="F0F0F0", fill_type="solid")
    
    border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    ws.merge_cells('A1:D1')
    ws['A1'] = f"Configurazione REDO - {codice_prodotto}"
    ws['A1'].font = header_font
    ws['A1'].fill = header_fill
    ws['A1'].alignment = Alignment(horizontal='center', vertical='center')
    
    ws['A2'] = "Data:"
    ws['B2'] = datetime.now().strftime("%d/%m/%Y %H:%M")
    
    row = 4
    
    sezioni = [
        ("Profilo", ["categoria", "profilo", "tipologia", "finitura"]),
        ("Strip LED", ["strip", "temperatura", "potenza", "tensione", "ip"]),
        ("Alimentazione", ["tipoAlimentazione", "tipoAlimentatore", "potenzaAlimentatore"]),
        ("Dimmerazione", ["dimmer"]),
        ("Cablaggio", ["uscitaCavo", "lunghezzaCavoIngresso", "lunghezzaCavoUscita"]),
        ("Dimensioni", ["forma", "lunghezzaTotale", "lunghezze"])
    ]
    
    for sezione, campi in sezioni:
        ws.merge_cells(f'A{row}:D{row}')
        ws[f'A{row}'] = sezione
        ws[f'A{row}'].font = subheader_font
        ws[f'A{row}'].fill = subheader_fill
        row += 1
        
        for campo in campi:
            if campo in configurazione:
                valore = configurazione[campo]
                
                if isinstance(valore, dict):
                    valore = json.dumps(valore, ensure_ascii=False)
                elif isinstance(valore, list):
                    valore = ", ".join(map(str, valore))
                elif valore is None:
                    valore = "N/A"
                
                ws[f'A{row}'] = campo.replace('_', ' ').title()
                ws[f'B{row}'] = str(valore)
                ws.merge_cells(f'B{row}:D{row}')
                
                for col in ['A', 'B', 'C', 'D']:
                    ws[f'{col}{row}'].border = border
                
                row += 1
        
        row += 1
    
    ws.merge_cells(f'A{row}:D{row}')
    ws[f'A{row}'] = "Calcoli e Note"
    ws[f'A{row}'].font = subheader_font
    ws[f'A{row}'].fill = subheader_fill
    row += 1
    
    if 'calcoliLunghezza' in configurazione:
        calcoli = configurazione['calcoliLunghezza']
        ws[f'A{row}'] = "Spazio Buio:"
        ws[f'B{row}'] = f"{calcoli.get('spazioBuio', 0)} mm"
        row += 1
        
        ws[f'A{row}'] = "Taglio Strip:"
        ws[f'B{row}'] = f"ogni {calcoli.get('taglioMinimo', 0)} mm"
        row += 1
    
    ws.column_dimensions['A'].width = 25
    ws.column_dimensions['B'].width = 30
    ws.column_dimensions['C'].width = 20
    ws.column_dimensions['D'].width = 20
    
    filename = f"REDO_Config_{codice_prodotto}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    filepath = os.path.join(tempfile.gettempdir(), filename)
    wb.save(filepath)
    
    return filename

@app.route('/get_opzioni_strip_standalone', methods=['POST'])
def get_opzioni_strip_standalone():
    data = request.json
    tipologia = data.get('tipologia')
    special = data.get('special')
    
    tensioni_disponibili = ['24V', '48V', '220V']
    
    if tipologia == 'SPECIAL' and special:
        if special in ['XFLEX', 'XSNAKE', 'XMAGIS']:
            tensioni_disponibili = ['24V']
        elif special == 'ZIG_ZAG':
            tensioni_disponibili = ['24V', '48V']
    
    return jsonify({'success': True, 'tensioni': tensioni_disponibili})

@app.route('/get_opzioni_ip_standalone', methods=['POST'])
def get_opzioni_ip_standalone():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'Nessun dato ricevuto'})
        
        tipologia = data.get('tipologia', '')
        tensione = data.get('tensione', '')
        special = data.get('special')

        gradi_ip = ['IP20', 'IP65', 'IP66', 'IP67']

        if tensione == '220V':
            gradi_ip = ['IP65', 'IP67']
        elif tensione == '48V':
            gradi_ip = ['IP20', 'IP65', 'IP66']
        elif tensione == '24V':
            gradi_ip = ['IP20', 'IP65', 'IP66', 'IP67']

        if tipologia == 'SPECIAL' and special:
            if special in ['XFLEX', 'XSNAKE']:
                gradi_ip = ['IP20', 'IP65']
            elif special == 'RUNNING':
                gradi_ip = ['IP20', 'IP66']
        
        return jsonify({'success': True, 'gradi_ip': gradi_ip})
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'Errore interno: {str(e)}'})

@app.route('/get_opzioni_temperatura_standalone', methods=['POST'])
def get_opzioni_temperatura_standalone():
    data = request.json
    temperature = ['2700K', '3000K', '4000K', '6000K', 'CCT', 'RGB', 'RGBW']
    return jsonify({'success': True, 'temperature': temperature})

@app.route('/get_opzioni_potenza_standalone', methods=['POST'])
def get_opzioni_potenza_standalone():
    data = request.json
    
    potenze = [
        {'id': '6W/m', 'nome': '6W/m'},
        {'id': '12W/m', 'nome': '12W/m'},
        {'id': '18W/m', 'nome': '18W/m'},
        {'id': '22W/m', 'nome': '22W/m'}
    ]
    
    return jsonify({'success': True, 'potenze': potenze})

@app.route('/get_strip_compatibile_standalone', methods=['POST'])
def get_strip_compatibile_standalone():
    data = request.json
    
    strip_id = f"STRIP_{data.get('tensione')}_COB_{data.get('ip')}"
    
    return jsonify({
        'success': True,
        'strip_led': {
            'id': strip_id,
            'nomeCommerciale': f"Strip {data.get('tipologia')} {data.get('tensione')} {data.get('ip')}"
        }
    })

@app.route('/get_strip_led_by_nome_commerciale/<nome_commerciale>')
def get_strip_led_by_nome_commerciale(nome_commerciale):
    try:
        strip_data = db.supabase.table('strip_led').select('*').eq('nome_commerciale', nome_commerciale).single().execute()
        
        if not strip_data.data:
            return jsonify({'success': False, 'message': f'Strip LED non trovata: {nome_commerciale}'})
        
        strip_info = strip_data.data
        
        temperature = db.supabase.table('strip_temperature').select('temperatura').eq('strip_id', strip_info['id']).execute().data
        potenze = db.supabase.table('strip_potenze').select('*').eq('strip_id', strip_info['id']).order('indice').execute().data
        
        return jsonify({
            'success': True,
            'strip_led': {
                'id': strip_info['id'],
                'nome': strip_info['nome'],
                'nomeCommerciale': strip_info.get('nome_commerciale', ''),
                'tensione': strip_info['tensione'],
                'ip': strip_info['ip'],
                'temperaturaColoreDisponibili': [t['temperatura'] for t in temperature],
                'potenzeDisponibili': [p['potenza'] for p in potenze],
                'codiciProdotto': [p['codice_prodotto'] for p in potenze]
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'database': 'supabase'})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)