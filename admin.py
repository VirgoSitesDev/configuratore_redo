from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for, flash
import os
from database import DatabaseManager
import logging
from datetime import datetime
import json

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')
db = DatabaseManager()

# Password admin da variabile ambiente
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')

def require_admin_login():
    """Verifica se l'admin è loggato"""
    if 'admin_logged_in' not in session:
        return redirect(url_for('admin.login'))
    return None

@admin_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        password = request.form.get('password')
        if password == ADMIN_PASSWORD:
            session['admin_logged_in'] = True
            return redirect(url_for('admin.dashboard'))
        else:
            flash('Password errata', 'error')
    
    return render_template('admin/login.html')

@admin_bp.route('/logout')
def logout():
    session.pop('admin_logged_in', None)
    return redirect(url_for('admin.login'))

@admin_bp.route('/')
@admin_bp.route('/dashboard')
def dashboard():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check
    
    try:
        # Statistiche generali
        stats = {}

        # Conta profili (from profili_prezzi table - shows actual entries displayed in admin)
        profili = db.supabase.table('profili_prezzi').select('*').execute()
        stats['profili'] = len(profili.data) if profili.data else 0

        # Conta strip LED (from strip_prezzi table - shows actual entries displayed in admin)
        strips = db.supabase.table('strip_prezzi').select('*').execute()
        stats['strip_led'] = len(strips.data) if strips.data else 0

        # Conta alimentatori (from alimentatori_potenze table - shows actual entries displayed in admin)
        alimentatori = db.supabase.table('alimentatori_potenze').select('*').execute()
        stats['alimentatori'] = len(alimentatori.data) if alimentatori.data else 0

        # Conta dimmer
        dimmer = db.supabase.table('dimmer').select('*').execute()
        stats['dimmer'] = len(dimmer.data) if dimmer.data else 0

        # Conta categorie
        categorie = db.supabase.table('categorie').select('*').execute()
        stats['categorie'] = len(categorie.data) if categorie.data else 0

        return render_template('admin/dashboard.html', stats=stats)
        
    except Exception as e:
        logging.error(f"Errore dashboard admin: {str(e)}")
        flash('Errore nel caricamento della dashboard', 'error')
        return render_template('admin/dashboard.html', stats={})

# =========================
# GESTIONE CATEGORIE
# =========================

@admin_bp.route('/categorie')
def categorie():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check
    
    try:
        categorie = db.supabase.table('categorie').select('*').execute()
        return render_template('admin/categorie.html', categorie=categorie.data or [])
    except Exception as e:
        logging.error(f"Errore caricamento categorie: {str(e)}")
        flash('Errore nel caricamento delle categorie', 'error')
        return render_template('admin/categorie.html', categorie=[])

@admin_bp.route('/categorie/add', methods=['POST'])
def add_categoria():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check
    
    try:
        data = request.json
        result = db.supabase.table('categorie').insert(data).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiunta categoria: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/categorie/update/<categoria_id>', methods=['PUT'])
def update_categoria(categoria_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check
    
    try:
        data = request.json
        result = db.supabase.table('categorie').update(data).eq('id', categoria_id).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiornamento categoria: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/categorie/delete/<categoria_id>', methods=['DELETE'])
def delete_categoria(categoria_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check
    
    try:
        result = db.supabase.table('categorie').delete().eq('id', categoria_id).execute()
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"Errore eliminazione categoria: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# =========================
# GESTIONE PROFILI
# =========================

@admin_bp.route('/profili')
def profili():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        # Fetch profili base data and categories
        profili = db.supabase.table('profili').select('*').execute()
        categorie = db.supabase.table('categorie').select('*').execute()

        # Fetch all profili_prezzi entries (main source with all combinations)
        prezzi = db.supabase.table('profili_prezzi').select('*').execute()

        # Create a lookup map for profili base info
        profili_map = {p['id']: p for p in (profili.data or [])}

        # Build combined list
        profili_combinati = []
        for prezzo in (prezzi.data or []):
            codice_listino = prezzo.get('codice_listino', '')
            profilo_id = prezzo.get('profilo_id')

            # Extract profile code from codice_listino (part before '/')
            profile_code = codice_listino.split('/')[0] if '/' in codice_listino else codice_listino

            # First try to get info from profilo_id
            profilo_info = profili_map.get(profilo_id, {})

            # If no info found with profilo_id, try to find by nome matching profile_code
            if not profilo_info or not profilo_info.get('nome'):
                profilo_info = next((p for p in (profili.data or []) if p.get('nome') == profile_code), {})

            profili_combinati.append({
                'prezzo_id': prezzo.get('id'),  # ID from profili_prezzi table
                'profilo_id': profilo_id,
                'nome': profilo_info.get('nome', profile_code or 'N/A'),
                'categoria': profilo_info.get('categoria', 'N/A'),
                'immagine': profilo_info.get('immagine'),
                'finitura': prezzo.get('finitura'),  # Get finitura directly from profili_prezzi
                'lunghezza': prezzo.get('lunghezza_mm'),  # Get length from lunghezza_mm column
                'codice_listino': codice_listino,
                'prezzo': prezzo.get('prezzo_euro')  # Get price from prezzo_euro column
            })

        return render_template('admin/profili.html',
                             profili_combinati=profili_combinati,
                             profili_base=profili.data or [],
                             categorie=categorie.data or [])
    except Exception as e:
        logging.error(f"Errore caricamento profili: {str(e)}")
        flash('Errore nel caricamento dei profili', 'error')
        return render_template('admin/profili.html', profili_combinati=[], profili_base=[], categorie=[])

@admin_bp.route('/profili/add_complete', methods=['POST'])
def add_profilo_complete():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        nome = request.form.get('nome')
        categoria = request.form.get('categoria')
        codice_listino = request.form.get('codice_listino')
        finitura = request.form.get('finitura')
        lunghezza_mm = request.form.get('lunghezza_mm')
        prezzo_euro = request.form.get('prezzo_euro')

        # Handle file upload
        immagine_url = None
        if 'immagine' in request.files:
            file = request.files['immagine']
            if file and file.filename:
                import os
                from werkzeug.utils import secure_filename
                import time

                # Get the absolute path to static/img folder
                base_dir = os.path.dirname(os.path.abspath(__file__))
                upload_folder = os.path.join(base_dir, 'static', 'img', 'profili')
                os.makedirs(upload_folder, exist_ok=True)

                # Save file with secure filename and timestamp
                filename = secure_filename(file.filename)
                timestamp = str(int(time.time()))
                name, ext = os.path.splitext(filename)
                filename = f"{name}_{timestamp}{ext}"

                file_path = os.path.join(upload_folder, filename)
                file.save(file_path)

                # Store relative URL for database
                immagine_url = f"/static/img/profili/{filename}"

        # Check if profile already exists in profili table by nome
        existing_profile = db.supabase.table('profili').select('*').eq('nome', nome).execute()

        if existing_profile.data and len(existing_profile.data) > 0:
            # Profile exists, use its id (which is a string like PRF014_200SET)
            profilo_id = existing_profile.data[0]['id']
        else:
            # Profile doesn't exist, create it in profili table
            # profili.id is a STRING, use nome as the id
            # Table: profili (id=STRING, nome, categoria, note, immagine, lunghezza_massima)
            profilo_data = {
                'id': nome,  # id is a string, same as nome (e.g., PRF005, MG13X12PF)
                'nome': nome,
                'categoria': categoria,
                'lunghezza_massima': int(lunghezza_mm)
            }
            if immagine_url:
                profilo_data['immagine'] = immagine_url

            profilo_result = db.supabase.table('profili').insert(profilo_data).execute()
            profilo_id = profilo_result.data[0]['id']

        # Insert into profili_tipologie (profilo_id, tipologia) - two rows
        try:
            db.supabase.table('profili_tipologie').insert({
                'profilo_id': profilo_id,
                'tipologia': 'profilo_intero'
            }).execute()
        except Exception as e:
            logging.warning(f"Tipologia profilo_intero might already exist: {str(e)}")

        try:
            db.supabase.table('profili_tipologie').insert({
                'profilo_id': profilo_id,
                'tipologia': 'taglio_misura'
            }).execute()
        except Exception as e:
            logging.warning(f"Tipologia taglio_misura might already exist: {str(e)}")

        # Insert into profili_finiture (profilo_id, finitura)
        try:
            db.supabase.table('profili_finiture').insert({
                'profilo_id': profilo_id,
                'finitura': finitura
            }).execute()
        except Exception as e:
            # Ignore if already exists
            logging.warning(f"Finitura might already exist: {str(e)}")

        # Insert into profili_lunghezze (profilo_id, lunghezza)
        try:
            db.supabase.table('profili_lunghezze').insert({
                'profilo_id': profilo_id,
                'lunghezza': int(lunghezza_mm)
            }).execute()
        except Exception as e:
            # Ignore if already exists
            logging.warning(f"Lunghezza might already exist: {str(e)}")

        # Insert into profili_prezzi (id, profilo_id, finitura, lunghezza_mm, prezzo_euro, codice_listino)
        prezzo_data = {
            'profilo_id': profilo_id,
            'codice_listino': codice_listino,
            'finitura': finitura,
            'lunghezza_mm': int(lunghezza_mm),
            'prezzo_euro': float(prezzo_euro)
        }

        prezzo_result = db.supabase.table('profili_prezzi').insert(prezzo_data).execute()

        return jsonify({'success': True, 'data': prezzo_result.data})
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logging.error(f"Errore aggiunta profilo completo: {str(e)}\n{error_trace}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/profili/add', methods=['POST'])
def add_profilo():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('profili').insert(data).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiunta profilo: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/profili/update/<profilo_id>', methods=['PUT'])
def update_profilo(profilo_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('profili').update(data).eq('id', profilo_id).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiornamento profilo: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/profili/delete/<profilo_id>', methods=['DELETE'])
def delete_profilo(profilo_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        result = db.supabase.table('profili').delete().eq('id', profilo_id).execute()
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"Errore eliminazione profilo: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# Routes for profili_prezzi (individual price entries)
@admin_bp.route('/profili/prezzi/update/<int:prezzo_id>', methods=['PUT'])
def update_profilo_prezzo(prezzo_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('profili_prezzi').update(data).eq('id', prezzo_id).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiornamento prezzo: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/profili/prezzi/add', methods=['POST'])
def add_profilo_prezzo():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('profili_prezzi').insert(data).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiunta prezzo: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/profili/prezzi/delete/<int:prezzo_id>', methods=['DELETE'])
def delete_profilo_prezzo(prezzo_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        result = db.supabase.table('profili_prezzi').delete().eq('id', prezzo_id).execute()
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"Errore eliminazione prezzo: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# Routes for profili_finiture
@admin_bp.route('/profili/finiture/add', methods=['POST'])
def add_profilo_finitura():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('profili_finiture').insert(data).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiunta finitura: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/profili/finiture/delete/<int:finitura_id>', methods=['DELETE'])
def delete_profilo_finitura(finitura_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        result = db.supabase.table('profili_finiture').delete().eq('id', finitura_id).execute()
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"Errore eliminazione finitura: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# Routes for profili_lunghezze
@admin_bp.route('/profili/lunghezze/add', methods=['POST'])
def add_profilo_lunghezza():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('profili_lunghezze').insert(data).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiunta lunghezza: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/profili/lunghezze/delete/<int:lunghezza_id>', methods=['DELETE'])
def delete_profilo_lunghezza(lunghezza_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        result = db.supabase.table('profili_lunghezze').delete().eq('id', lunghezza_id).execute()
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"Errore eliminazione lunghezza: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# =========================
# GESTIONE STRIP LED
# =========================

@admin_bp.route('/strip_led')
def strip_led():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        import re

        # Fetch all strip_prezzi entries (main source)
        prezzi = db.supabase.table('strip_prezzi').select('*').execute()

        # Fetch strip_led base data for lookup
        strips_base = db.supabase.table('strip_led').select('*').execute()

        # Fetch all strip_potenze for power index lookup
        potenze = db.supabase.table('strip_potenze').select('*').execute()

        # Create a lookup map for strip_led base info
        strips_map = {s['id']: s for s in (strips_base.data or [])}

        # Create a lookup map for potenze indices: {strip_id: {potenza: indice}}
        potenze_map = {}
        for p in (potenze.data or []):
            strip_id = p.get('strip_id')
            if strip_id not in potenze_map:
                potenze_map[strip_id] = {}
            potenze_map[strip_id][p.get('potenza')] = p.get('indice', -1)

        # Build combined list
        strips_combinati = []
        for prezzo in (prezzi.data or []):
            strip_id = prezzo.get('strip_id')
            potenza = prezzo.get('potenza')
            strip_info = strips_map.get(strip_id, {})

            # Get taglio_minimo for this specific power
            taglio_minimo_val = '-'
            tagli_minimi = strip_info.get('taglio_minimo', [])

            if strip_id in potenze_map and potenza in potenze_map[strip_id]:
                indice = potenze_map[strip_id][potenza]
                if indice >= 0 and indice < len(tagli_minimi):
                    taglio_minimo_str = tagli_minimi[indice]
                    match = re.search(r'(\d+(?:[.,]\d+)?)', str(taglio_minimo_str))
                    if match:
                        taglio_minimo_val = match.group(1).replace(',', '.')

            strips_combinati.append({
                'prezzo_id': prezzo.get('id'),
                'strip_id': strip_id,
                'tipo': strip_info.get('tipo'),
                'nome_commerciale': strip_info.get('nome_commerciale'),
                'tensione': strip_info.get('tensione'),
                'ip': strip_info.get('ip'),
                'lunghezza': strip_info.get('lunghezza'),
                'larghezza': strip_info.get('larghezza'),
                'giuntabile': strip_info.get('giuntabile'),
                'taglio_minimo': taglio_minimo_val,
                'temperatura': prezzo.get('temperatura'),
                'potenza': prezzo.get('potenza'),
                'codice_completo': prezzo.get('codice_completo'),
                'prezzo': prezzo.get('prezzo_euro')
            })

        return render_template('admin/strip_led.html', strips=strips_combinati)
    except Exception as e:
        logging.error(f"Errore caricamento strip LED: {str(e)}")
        flash('Errore nel caricamento delle strip LED', 'error')
        return render_template('admin/strip_led.html', strips=[])

@admin_bp.route('/strip_led/add', methods=['POST'])
def add_strip_led():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('strip_led').insert(data).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiunta strip LED: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/strip_led/update/<strip_id>', methods=['PUT'])
def update_strip_led(strip_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('strip_led').update(data).eq('id', strip_id).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiornamento strip LED: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/strip_led/delete/<strip_id>', methods=['DELETE'])
def delete_strip_led(strip_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        result = db.supabase.table('strip_led').delete().eq('id', strip_id).execute()
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"Errore eliminazione strip LED: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# Routes for strip_prezzi (individual price entries)
@admin_bp.route('/strip_prezzi/update/<int:prezzo_id>', methods=['PUT'])
def update_strip_prezzo(prezzo_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('strip_prezzi').update(data).eq('id', prezzo_id).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiornamento strip prezzo: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/strip_prezzi/delete/<int:prezzo_id>', methods=['DELETE'])
def delete_strip_prezzo(prezzo_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        result = db.supabase.table('strip_prezzi').delete().eq('id', prezzo_id).execute()
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"Errore eliminazione strip prezzo: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# =========================
# GESTIONE ALIMENTATORI
# =========================

@admin_bp.route('/alimentatori')
def alimentatori():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        # Fetch all alimentatori_potenze entries (main source)
        potenze = db.supabase.table('alimentatori_potenze').select('*').execute()

        # Fetch alimentatori base data for lookup
        alimentatori_base = db.supabase.table('alimentatori').select('*').execute()

        # Create a lookup map for alimentatori base info
        alimentatori_map = {a['id']: a for a in (alimentatori_base.data or [])}

        # Build combined list
        alimentatori_combinati = []
        for potenza in (potenze.data or []):
            alimentatore_id = potenza.get('alimentatore_id')
            alimentatore_info = alimentatori_map.get(alimentatore_id, {})

            alimentatori_combinati.append({
                'potenza_id': potenza.get('id'),
                'alimentatore_id': alimentatore_id,
                'nome': alimentatore_info.get('nome'),
                'tensione': alimentatore_info.get('tensione'),
                'ip': alimentatore_info.get('ip'),
                'potenza': potenza.get('potenza'),
                'codice': potenza.get('codice'),
                'prezzo': potenza.get('price')
            })

        return render_template('admin/alimentatori.html', alimentatori=alimentatori_combinati)
    except Exception as e:
        logging.error(f"Errore caricamento alimentatori: {str(e)}")
        flash('Errore nel caricamento degli alimentatori', 'error')
        return render_template('admin/alimentatori.html', alimentatori=[])

@admin_bp.route('/alimentatori/add', methods=['POST'])
def add_alimentatore():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('alimentatori').insert(data).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiunta alimentatore: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/alimentatori/update/<alimentatore_id>', methods=['PUT'])
def update_alimentatore(alimentatore_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('alimentatori').update(data).eq('id', alimentatore_id).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiornamento alimentatore: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/alimentatori/delete/<alimentatore_id>', methods=['DELETE'])
def delete_alimentatore(alimentatore_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        result = db.supabase.table('alimentatori').delete().eq('id', alimentatore_id).execute()
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"Errore eliminazione alimentatore: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# Routes for alimentatori_potenze (individual power entries)
@admin_bp.route('/alimentatori_potenze/update/<int:potenza_id>', methods=['PUT'])
def update_alimentatore_potenza(potenza_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('alimentatori_potenze').update(data).eq('id', potenza_id).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiornamento alimentatore potenza: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/alimentatori_potenze/delete/<int:potenza_id>', methods=['DELETE'])
def delete_alimentatore_potenza(potenza_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        result = db.supabase.table('alimentatori_potenze').delete().eq('id', potenza_id).execute()
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"Errore eliminazione alimentatore potenza: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# =========================
# GESTIONE DIMMER
# =========================

@admin_bp.route('/dimmer')
def dimmer():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        dimmer = db.supabase.table('dimmer').select('*').execute()
        return render_template('admin/dimmer.html', dimmer=dimmer.data or [])
    except Exception as e:
        logging.error(f"Errore caricamento dimmer: {str(e)}")
        flash('Errore nel caricamento dei dimmer', 'error')
        return render_template('admin/dimmer.html', dimmer=[])

@admin_bp.route('/dimmer/add', methods=['POST'])
def add_dimmer():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('dimmer').insert(data).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiunta dimmer: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/dimmer/update/<dimmer_id>', methods=['PUT'])
def update_dimmer(dimmer_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        data = request.json
        result = db.supabase.table('dimmer').update(data).eq('id', dimmer_id).execute()
        return jsonify({'success': True, 'data': result.data})
    except Exception as e:
        logging.error(f"Errore aggiornamento dimmer: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@admin_bp.route('/dimmer/delete/<dimmer_id>', methods=['DELETE'])
def delete_dimmer(dimmer_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check

    try:
        result = db.supabase.table('dimmer').delete().eq('id', dimmer_id).execute()
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"Errore eliminazione dimmer: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# =========================
# GESTIONE CONFIGURAZIONI SALVATE
# =========================

@admin_bp.route('/configurazioni')
def configurazioni():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check
    
    try:
        configs = db.supabase.table('configurazioni_salvate').select('*').order('created_at', desc=True).execute()
        return render_template('admin/configurazioni.html', configurazioni=configs.data or [])
    except Exception as e:
        logging.error(f"Errore caricamento configurazioni: {str(e)}")
        flash('Errore nel caricamento delle configurazioni', 'error')
        return render_template('admin/configurazioni.html', configurazioni=[])

@admin_bp.route('/configurazioni/delete/<config_id>', methods=['DELETE'])
def delete_configurazione(config_id):
    auth_check = require_admin_login()
    if auth_check:
        return auth_check
    
    try:
        result = db.supabase.table('configurazioni_salvate').delete().eq('id', config_id).execute()
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"Errore eliminazione configurazione: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# =========================
# OPERAZIONI IN BLOCCO
# =========================

@admin_bp.route('/bulk-delete', methods=['POST'])
def bulk_delete():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check
    
    try:
        data = request.json
        table = data.get('table')
        ids = data.get('ids', [])
        
        if not table or not ids:
            return jsonify({'success': False, 'error': 'Parametri mancanti'})
        
        # Validazione tabella per sicurezza
        allowed_tables = ['categorie', 'profili', 'strip_led', 'alimentatori', 'dimmer', 'configurazioni_salvate']
        if table not in allowed_tables:
            return jsonify({'success': False, 'error': 'Tabella non valida'})
        
        for item_id in ids:
            db.supabase.table(table).delete().eq('id', item_id).execute()
        
        return jsonify({'success': True, 'deleted_count': len(ids)})
        
    except Exception as e:
        logging.error(f"Errore eliminazione in blocco: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})