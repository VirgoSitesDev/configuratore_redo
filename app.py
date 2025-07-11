from flask import Flask, render_template, request, jsonify
import os
import json

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

def load_config_data():
    try:
        json_path = os.path.join(os.path.dirname(__file__), 'static/data/configurazioni.json')
        print(f"Tentativo di caricamento del file JSON da: {json_path}")
        
        if os.path.exists(json_path):
            with open(json_path, 'r', encoding='utf-8') as file:
                data = json.load(file)
                print(f"File JSON caricato con successo: {json_path}")
                return data
        else:
            alternative_path = 'configurazione.json'
            if os.path.exists(alternative_path):
                with open(alternative_path, 'r', encoding='utf-8') as file:
                    data = json.load(file)
                    print(f"File JSON caricato con successo: {alternative_path}")
                    return data
            else:
                print(f"File JSON non trovato in nessun percorso")
                return {}
    except Exception as e:
        print(f"Errore nel caricamento del file JSON: {e}")
        return {}

CONFIG_DATA = load_config_data()

@app.route('/get_opzioni_strip_standalone', methods=['POST'])
def get_opzioni_strip_standalone():
    data = request.json
    tipologia = data.get('tipologia')
    special = data.get('special')
    
    # Logica per ottenere tensioni disponibili per strip standalone
    tensioni_disponibili = ['24V', '48V', '220V']
    
    if tipologia == 'SPECIAL' and special:
        if special in ['XFLEX', 'XSNAKE', 'XMAGIS']:
            tensioni_disponibili = ['24V']
        elif special == 'ZIG_ZAG':
            tensioni_disponibili = ['24V', '48V']
    
    return jsonify({
        'success': True,
        'tensioni': tensioni_disponibili
    })

@app.route('/get_opzioni_ip_standalone', methods=['POST'])
def get_opzioni_ip_standalone():
    try:
        data = request.get_json()
        print(f"Dati ricevuti per IP: {data}")
        
        if not data:
            print("Errore: Nessun dato JSON ricevuto")
            return jsonify({
                'success': False, 
                'message': 'Nessun dato ricevuto'
            })
        
        tipologia = data.get('tipologia', '')
        tensione = data.get('tensione', '')
        special = data.get('special')
        
        print(f"Parametri: tipologia={tipologia}, tensione={tensione}, special={special}")

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
        
        print(f"Gradi IP restituiti: {gradi_ip}")
        
        return jsonify({
            'success': True,
            'gradi_ip': gradi_ip
        })
        
    except Exception as e:
        print(f"Errore in get_opzioni_ip_standalone: {e}")
        return jsonify({
            'success': False, 
            'message': f'Errore interno: {str(e)}'
        })

@app.route('/get_opzioni_temperatura_standalone', methods=['POST'])
def get_opzioni_temperatura_standalone():
    data = request.json
    
    temperature = ['2700K', '3000K', '4000K', '6000K', 'CCT', 'RGB', 'RGBW']
    
    return jsonify({
        'success': True,
        'temperature': temperature
    })

@app.route('/get_opzioni_potenza_standalone', methods=['POST'])
def get_opzioni_potenza_standalone():
    data = request.json
    
    potenze = [
        {'id': '6W/m', 'nome': '6W/m'},
        {'id': '12W/m', 'nome': '12W/m'},
        {'id': '18W/m', 'nome': '18W/m'},
        {'id': '22W/m', 'nome': '22W/m'}
    ]
    
    return jsonify({
        'success': True,
        'potenze': potenze
    })

@app.route('/get_strip_compatibile_standalone', methods=['POST'])
def get_strip_compatibile_standalone():
    data = request.json
    
    # Logica semplificata per trovare strip compatibile
    strip_id = f"STRIP_{data.get('tensione')}_COB_{data.get('ip')}"
    
    return jsonify({
        'success': True,
        'strip_led': {
            'id': strip_id,
            'nomeCommerciale': f"Strip {data.get('tipologia')} {data.get('tensione')} {data.get('ip')}"
        }
    })

@app.route('/get_categorie')
def get_categorie():
    categorie = CONFIG_DATA.get('categoriePrincipali', [])
    print(f"Restituendo {len(categorie)} categorie")
    return jsonify(categorie)

@app.route('/get_profili/<categoria>')
def get_profili(categoria):
    profili = CONFIG_DATA.get('profili', [])
    profili_categoria = []
    for p in profili:
        if p.get('categoria') == categoria or (isinstance(p.get('categorie'), list) and categoria in p.get('categorie', [])):
            profilo = p.copy()
            strip_compatibili_info = []
            for strip_id in p.get('stripLedCompatibili', []):
                strip_info = CONFIG_DATA.get('stripLed', {}).get(strip_id, {})
                if strip_info:
                    strip_compatibili_info.append({
                        'id': strip_id,
                        'nomeCommerciale': strip_info.get('nomeCommerciale', '')
                    })
            profilo['stripLedCompatibiliInfo'] = strip_compatibili_info
            profili_categoria.append(profilo)
    
    print(f"Categoria: {categoria}, Profili trovati: {len(profili_categoria)}")
    return jsonify(profili_categoria)

@app.route('/get_opzioni_profilo/<profilo_id>')
def get_opzioni_profilo(profilo_id):
    profili = CONFIG_DATA.get('profili', [])
    
    profilo = next((p for p in profili if p.get('id') == profilo_id), None)
    
    if profilo:
        return jsonify({
            'tipologie': profilo.get('tipologie', [])
        })
    else:
        print(f"Profilo non trovato: {profilo_id}")
        return jsonify({'tipologie': []})

@app.route('/get_opzioni_tensione/<profilo_id>')
@app.route('/get_opzioni_tensione/<profilo_id>/<tipologia_strip>')
def get_opzioni_tensione(profilo_id, tipologia_strip=None):
    if profilo_id == 'ESTERNI':
        voltaggi_disponibili = ['24V', '48V', '220V']
        
        if tipologia_strip == 'SPECIAL':
            voltaggi_disponibili = ['24V']
        
        return jsonify({
            'success': True,
            'voltaggi': voltaggi_disponibili
        })
    
    profili = CONFIG_DATA.get('profili', [])
    profilo = next((p for p in profili if p.get('id') == profilo_id), None)
    
    if not profilo:
        return jsonify({'success': False, 'message': 'Profilo non trovato'})

    strip_led_compatibili = profilo.get('stripLedCompatibili', [])
    strip_led_data = CONFIG_DATA.get('stripLed', {})

    
    voltaggi_disponibili = set()
    for strip_id in strip_led_compatibili:
        strip_info = strip_led_data.get(strip_id, {})
        if tipologia_strip:
            if tipologia_strip == 'COB' and 'COB' not in strip_id:
                continue
            elif tipologia_strip == 'SMD' and 'SMD' not in strip_id:
                continue
            elif tipologia_strip == 'SPECIAL':
                strip_info = strip_led_data.get(strip_id, {})
                if strip_info.get('tipo') != 'SPECIAL':
                    continue
            
        tensione = strip_info.get('tensione')
        if tensione:
            voltaggi_disponibili.add(tensione)
    
    return jsonify({
        'success': True,
        'voltaggi': list(voltaggi_disponibili)
    })

@app.route('/get_opzioni_ip/<profilo_id>/<tensione>')
@app.route('/get_opzioni_ip/<profilo_id>/<tensione>/<tipologia_strip>')
def get_opzioni_ip(profilo_id, tensione, tipologia_strip=None):
    profili = CONFIG_DATA.get('profili', [])
    profilo = next((p for p in profili if p.get('id') == profilo_id), None)
    
    if not profilo:
        return jsonify({'success': False, 'message': 'Profilo non trovato'})
    
    strip_led_compatibili = profilo.get('stripLedCompatibili', [])
    strip_led_data = CONFIG_DATA.get('stripLed', {})
    
    ip_disponibili = set()
    for strip_id in strip_led_compatibili:
        strip_info = strip_led_data.get(strip_id, {})

        if tipologia_strip:
            if tipologia_strip == 'COB' and 'COB' not in strip_id:
                continue
            elif tipologia_strip == 'SMD' and 'SMD' not in strip_id:
                continue
            elif tipologia_strip == 'SPECIAL':
                strip_info = strip_led_data.get(strip_id, {})
                if strip_info.get('tipo') != 'SPECIAL':
                    continue
                
        if strip_info.get('tensione') == tensione:
            ip = strip_info.get('ip')
            if ip:
                ip_disponibili.add(ip)
    
    return jsonify({
        'success': True,
        'ip': list(ip_disponibili)
    })

@app.route('/get_opzioni_temperatura_iniziale/<profilo_id>/<tensione>/<ip>')
@app.route('/get_opzioni_temperatura_iniziale/<profilo_id>/<tensione>/<ip>/<tipologia_strip>')
def get_opzioni_temperatura_iniziale(profilo_id, tensione, ip, tipologia_strip=None):
    profili = CONFIG_DATA.get('profili', [])
    profilo = next((p for p in profili if p.get('id') == profilo_id), None)
    
    if not profilo:
        return jsonify({'success': False, 'message': 'Profilo non trovato'})
    
    strip_led_compatibili = profilo.get('stripLedCompatibili', [])
    strip_led_data = CONFIG_DATA.get('stripLed', {})
    
    temperature_disponibili = set()
    for strip_id in strip_led_compatibili:
        strip_info = strip_led_data.get(strip_id, {})

        if tipologia_strip:
            if tipologia_strip == 'COB' and 'COB' not in strip_id:
                continue
            elif tipologia_strip == 'SMD' and 'SMD' not in strip_id:
                continue
            elif tipologia_strip == 'SPECIAL':
                strip_info = strip_led_data.get(strip_id, {})
                if strip_info.get('tipo') != 'SPECIAL':
                    continue
                
        if strip_info.get('tensione') == tensione and strip_info.get('ip') == ip:
            temperature_disponibili.update(strip_info.get('temperaturaColoreDisponibili', []))
    
    return jsonify({
        'success': True,
        'temperature': list(temperature_disponibili)
    })

@app.route('/get_dimmer_compatibili/<strip_id>')
def get_dimmer_compatibili(strip_id):
    dimmerazione = CONFIG_DATA.get('dimmerazione', {})
    compatibilita = dimmerazione.get('compatibilitaDimmer', {})
    
    dimmer_compatibili = []
    for dimmer, strip_compatibili in compatibilita.items():
        if strip_id in strip_compatibili:
            dimmer_compatibili.append(dimmer)
    
    return jsonify({
        'success': True,
        'dimmer_compatibili': dimmer_compatibili
    })

@app.route('/get_opzioni_dimmerazione/<strip_id>')
def get_opzioni_dimmerazione(strip_id):
    dimmerazione = CONFIG_DATA.get('dimmerazione', {})
    opzioni_base = dimmerazione.get('opzioni', [])
    compatibilita = dimmerazione.get('compatibilitaDimmer', {})

    strip_led_data = CONFIG_DATA.get('stripLed', {})
    strip_info = strip_led_data.get(strip_id, {})
    nome_commerciale = strip_info.get('nomeCommerciale', '')
    
    dimmer_compatibili = []

    if nome_commerciale:
        for dimmer, strip_compatibili in compatibilita.items():
            if nome_commerciale in strip_compatibili:
                dimmer_compatibili.append(dimmer)

    if not dimmer_compatibili:
        for dimmer, strip_compatibili in compatibilita.items():
            if strip_id in strip_compatibili:
                dimmer_compatibili.append(dimmer)

    if not dimmer_compatibili and "NESSUN_DIMMER" in opzioni_base:
        opzioni_filtrate = ["NESSUN_DIMMER"]
    else:
        opzioni_filtrate = dimmer_compatibili.copy()
        if "NESSUN_DIMMER" in opzioni_base and "NESSUN_DIMMER" not in opzioni_filtrate:
            opzioni_filtrate.append("NESSUN_DIMMER")

    codici_dimmer = {}
    for dimmer in opzioni_filtrate:
        codice = dimmerazione.get('codiciDimmer', {}).get(dimmer, "")
        if codice:
            codici_dimmer[dimmer] = codice

    nomi_dimmer = {}
    for dimmer in opzioni_filtrate:
        nome = dimmerazione.get('nomeDimmer', {}).get(dimmer, "")
        if nome:
            nomi_dimmer[dimmer] = nome
    
    return jsonify({
        'success': True,
        'opzioni': opzioni_filtrate,
        'spaziNonIlluminati': dimmerazione.get('spaziNonIlluminati', {}),
        'codiciDimmer': codici_dimmer,
        'nomiDimmer': nomi_dimmer
    })

@app.route('/get_opzioni_potenza/<profilo_id>/<tensione>/<ip>/<temperatura>')
@app.route('/get_opzioni_potenza/<profilo_id>/<tensione>/<ip>/<temperatura>/<tipologia_strip>')
def get_opzioni_potenza(profilo_id, tensione, ip, temperatura, tipologia_strip=None):
    profili = CONFIG_DATA.get('profili', [])
    profilo = next((p for p in profili if p.get('id') == profilo_id), None)
    
    if not profilo:
        return jsonify({'success': False, 'message': 'Profilo non trovato'})
    
    strip_led_compatibili = profilo.get('stripLedCompatibili', [])
    strip_led_data = CONFIG_DATA.get('stripLed', {})
    
    tutte_potenze_disponibili = set()
    
    for strip_id in strip_led_compatibili:
        strip_info = strip_led_data.get(strip_id, {})

        if tipologia_strip:
            if tipologia_strip == 'COB' and 'COB' not in strip_id:
                continue
            elif tipologia_strip == 'SMD' and 'SMD' not in strip_id:
                continue
            elif tipologia_strip == 'SPECIAL':
                strip_info = strip_led_data.get(strip_id, {})
                if strip_info.get('tipo') != 'SPECIAL':
                    continue

        if (strip_info.get('tensione') == tensione and 
            strip_info.get('ip') == ip and 
            temperatura in strip_info.get('temperaturaColoreDisponibili', [])):
            tutte_potenze_disponibili.update(strip_info.get('potenzeDisponibili', []))
    
    if not tutte_potenze_disponibili:
        return jsonify({'success': False, 'message': 'Nessuna potenza disponibile per i parametri selezionati'})
    
    potenze_disponibili_list = list(tutte_potenze_disponibili)
    dettagli_potenze = CONFIG_DATA.get('dettagliPotenze', {})
    
    potenze_complete = []
    for potenza in potenze_disponibili_list:
        potenza_key = potenza
        if potenza_key not in dettagli_potenze:
            for key in dettagli_potenze:
                if key.startswith(potenza):
                    potenza_key = key
                    break
                    
        dettaglio = dettagli_potenze.get(potenza_key, {})
        potenze_complete.append({
            'id': potenza,
            'nome': potenza,
            'codice': dettaglio.get('codice', ''),
            'specifiche': dettaglio.get('specifiche', '')
        })
    
    return jsonify({
        'success': True,
        'potenze': potenze_complete
    })


@app.route('/get_strip_led_filtrate/<profilo_id>/<tensione>/<ip>/<temperatura>/<potenza>')
@app.route('/get_strip_led_filtrate/<profilo_id>/<tensione>/<ip>/<temperatura>/<potenza>/<tipologia_strip>')
def get_strip_led_filtrate(profilo_id, tensione, ip, temperatura, potenza, tipologia_strip = None):
    try:
        print(f"Chiamata a get_strip_led_filtrate con: {profilo_id}, {tensione}, {ip}, {temperatura}, {potenza}")

        potenza = potenza.replace('-', ' ')
        potenza = potenza.replace('_', '/')

        print(potenza)
        
        profili = CONFIG_DATA.get('profili', [])
        profilo = next((p for p in profili if p.get('id') == profilo_id), None)
        
        if not profilo:
            return jsonify({'success': False, 'message': 'Profilo non trovato'})

        strip_led_compatibili = profilo.get('stripLedCompatibili', [])
        strip_led_data = CONFIG_DATA.get('stripLed', {})
        
        strip_led_filtrate = []
        for strip_id in strip_led_compatibili:
            strip_info = strip_led_data.get(strip_id, {})
            
            if tipologia_strip:
                if tipologia_strip == 'COB' and 'COB' not in strip_id:
                    continue
                elif tipologia_strip == 'SMD' and 'SMD' not in strip_id:
                    continue
                elif tipologia_strip == 'SPECIAL':
                    strip_info = strip_led_data.get(strip_id, {})
                    if strip_info.get('tipo') != 'SPECIAL':
                        continue

            if (strip_info.get('tensione') == tensione and 
                strip_info.get('ip') == ip and 
                temperatura in strip_info.get('temperaturaColoreDisponibili', []) and
                potenza in strip_info.get('potenzeDisponibili', [])):
                
                strip_led_filtrate.append({
                    'id': strip_id,
                    'nome': strip_info.get('nome', strip_id),
                    'nomeCommerciale': strip_info.get('nomeCommerciale', ''),
                    'descrizione': strip_info.get('descrizione', ''),
                    'tensione': tensione,
                    'ip': ip,
                    'temperatura': temperatura,
                    'potenzeDisponibili': strip_info.get('potenzeDisponibili', []),
                    'codiciProdotto': strip_info.get('codiciProdotto', [])
                })
        
        return jsonify({
            'success': True,
            'strip_led': strip_led_filtrate
        })
    except Exception as e:
        print(f"Errore in get_strip_led_filtrate: {e}")
        return jsonify({'success': False, 'message': f'Errore: {str(e)}'})

@app.route('/get_opzioni_alimentatore/<tipo_alimentazione>/<tensione_strip>', methods=['GET'])
@app.route('/get_opzioni_alimentatore/<tipo_alimentazione>/<tensione_strip>/<potenza_consigliata>', methods=['GET'])
def get_opzioni_alimentatore(tipo_alimentazione, tensione_strip, potenza_consigliata=None):
    try:
        alimentatori = []
        potenza_consigliata_int = 0
        if potenza_consigliata:
            try:
                potenza_consigliata_int = int(potenza_consigliata)
            except ValueError:
                pass

        dettagli_alimentatori = CONFIG_DATA.get('dettagliAlimentatori', {})

        if tipo_alimentazione == 'ON-OFF':
            if tensione_strip == '24V':
                alimentatori_possibili = [
                    {'id': 'SERIE_AT24', 'nome': 'SERIE AT24', 'descrizione': 'Carcassa in lamiera forata di acciaio zincato, per assicurare una corretta ventilazione.'},
                    {'id': 'SERIE_ATUS', 'nome': 'SERIE ATUS', 'descrizione': 'Alimentatore in tensione costante 24V, forma ultra slim, per interni (IP20). Carcassa in policarbonato bianco.'},
                    {'id': 'SERIE_ATSIP44', 'nome': 'SERIE ATSIP44', 'descrizione': 'Alimentatore in tensione costante 24V, forma stretta, per installazione in interno (IP44). Scatola e coperchi per i contatti elettrici in policarbonato.'},
                    {'id': 'SERIE_AT24IP67', 'nome': 'SERIE AT24IP67', 'descrizione': 'Alimentatore in tensione costante 24V per installazione in esterno (IP67). Con cavi flessibili in ingresso e uscita.'},
                    {'id': 'SERIE_ATN24IP67', 'nome': 'SERIE ATN24IP67', 'descrizione': 'Alimentatore in tensione costante 24V per installazione in esterno. Scatola in alluminio con cavi flessibili in ingresso e uscita.'}
                ]

                if potenza_consigliata_int > 0:
                    for alim in alimentatori_possibili:
                        alim_details = dettagli_alimentatori.get(alim['id'], {})
                        potenze = alim_details.get('potenze', [])
                        if any(p >= potenza_consigliata_int for p in potenze):
                            alimentatori.append(alim)
                else:
                    alimentatori.extend(alimentatori_possibili)
                    
            elif tensione_strip == '48V':
                alimentatori_possibili = [
                    {'id': 'SERIE_ATS48IP44', 'nome': 'SERIE ATS48IP44', 'descrizione': 'Alimentatore in tensione costante 48V per installazione in interno (IP44).'}
                ]

                if potenza_consigliata_int > 0:
                    for alim in alimentatori_possibili:
                        alim_details = dettagli_alimentatori.get(alim['id'], {})
                        potenze = alim_details.get('potenze', [])
                        if any(p >= potenza_consigliata_int for p in potenze):
                            alimentatori.append(alim)
                else:
                    alimentatori.extend(alimentatori_possibili)

        elif tipo_alimentazione == 'DIMMERABILE_TRIAC':
            if tensione_strip == '24V':
                alimentatori_possibili = [
                    {'id': 'SERIE_ATD24', 'nome': 'SERIE ATD24', 'descrizione': 'Alimentatore dimmerabile TRIAC, in tensione costante 24V DC, per installazione in interno (IP20).'},
                    {'id': 'SERIE_ATD24IP67', 'nome': 'SERIE ATD24IP67', 'descrizione': 'Alimentatore dimmerabile TRIAC, in tensione costante 24V per installazione in esterno (IP67). Con cavi flessibili in ingresso e uscita.'}
                ]

                if potenza_consigliata_int > 0:
                    for alim in alimentatori_possibili:
                        alim_details = dettagli_alimentatori.get(alim['id'], {})
                        potenze = alim_details.get('potenze', [])
                        if any(p >= potenza_consigliata_int for p in potenze):
                            alimentatori.append(alim)
                else:
                    alimentatori.extend(alimentatori_possibili)
        
        return jsonify({'success': True, 'alimentatori': alimentatori})
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_potenze_alimentatore/<alimentatore_id>')
def get_potenze_alimentatore(alimentatore_id):
    """
    Restituisce le potenze disponibili per l'alimentatore selezionato
    """
    dettagli_alimentatori = CONFIG_DATA.get('dettagliAlimentatori', {})
    alimentatore = dettagli_alimentatori.get(alimentatore_id, {})
    
    if not alimentatore:
        return jsonify({
            'success': False,
            'message': f'Alimentatore non trovato: {alimentatore_id}'
        })
    
    potenze = alimentatore.get('potenze', [])
    
    return jsonify({
        'success': True,
        'potenze': potenze
    })

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

@app.route('/get_strip_led_by_nome_commerciale/<nome_commerciale>')
def get_strip_led_by_nome_commerciale(nome_commerciale):
    mappatura = CONFIG_DATA.get('mappaturaCommerciale', {})
    strip_id = mappatura.get(nome_commerciale, None)
    
    if not strip_id:
        return jsonify({
            'success': False,
            'message': f'Strip LED non trovata con nome commerciale: {nome_commerciale}'
        })
    
    strip_info = CONFIG_DATA.get('stripLed', {}).get(strip_id, {})
    
    return jsonify({
        'success': True,
        'strip_led': {
            'id': strip_id,
            'nome': strip_info.get('nome', ''),
            'nomeCommerciale': strip_info.get('nomeCommerciale', ''),
            'tensione': strip_info.get('tensione', ''),
            'ip': strip_info.get('ip', ''),
            'temperaturaColoreDisponibili': strip_info.get('temperaturaColoreDisponibili', []),
            'potenzeDisponibili': strip_info.get('potenzeDisponibili', []),
            'codiciProdotto': strip_info.get('codiciProdotto', [])
        }
    })

@app.route('/calcola_lunghezze', methods=['POST'])
def calcola_lunghezze():
    data = request.json
    dim_richiesta = data.get('lunghezzaRichiesta', 0)
    strip_id = data.get('stripLedSelezionata')
    potenza_selezionata = data.get('potenzaSelezionata')
    lunghezze_multiple = data.get('lunghezzeMultiple', {})
    forma_taglio = data.get('formaDiTaglioSelezionata', 'DRITTO_SEMPLICE')
    
    taglio_minimo = 1
    spazio_produzione = CONFIG_DATA.get('spazioProduzione', 5)

    if strip_id and strip_id != 'NO_STRIP' and potenza_selezionata:
        strip_info = CONFIG_DATA.get('stripLed', {}).get(strip_id, {})
        potenze_disponibili = strip_info.get('potenzeDisponibili', [])
        tagli_minimi = strip_info.get('taglioMinimo', [])
        potenza_index = -1
        for i, potenza in enumerate(potenze_disponibili):
            if potenza == potenza_selezionata:
                potenza_index = i
                break

        if potenza_index >= 0 and potenza_index < len(tagli_minimi):
            taglio_minimo_str = tagli_minimi[potenza_index]

            import re
            match = re.search(r'(\d+(?:[.,]\d+)?)', taglio_minimo_str)
            if match:
                taglio_minimo_val = match.group(1).replace(',', '.')
                try:
                    taglio_minimo = float(taglio_minimo_val)
                except ValueError:
                    print(f"Errore nel parsing del valore del taglio minimo: {taglio_minimo_str}")

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

@app.route('/get_finiture/<profilo_id>')
def get_finiture(profilo_id):
    profili = CONFIG_DATA.get('profili', [])
    
    profilo = next((p for p in profili if p.get('id') == profilo_id), None)
    
    finiture_disponibili = []
    if profilo:
        finiture_disponibili = profilo.get('finitureDisponibili', [])
    
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
        for finitura in finiture_disponibili
    ]
    
    return jsonify({
        'success': True,
        'finiture': finiture_formattate
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)