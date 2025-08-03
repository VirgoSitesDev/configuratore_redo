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
        
        # Conta configurazioni salvate
        configs = db.supabase.table('configurazioni_salvate').select('*').execute()
        stats['configurazioni'] = len(configs.data) if configs.data else 0
        
        # Conta profili
        profili = db.supabase.table('profili').select('*').execute()
        stats['profili'] = len(profili.data) if profili.data else 0
        
        # Conta strip LED
        strips = db.supabase.table('strip_led').select('*').execute()
        stats['strip_led'] = len(strips.data) if strips.data else 0
        
        # Conta alimentatori
        alimentatori = db.supabase.table('alimentatori').select('*').execute()
        stats['alimentatori'] = len(alimentatori.data) if alimentatori.data else 0
        
        # Conta dimmer
        dimmer = db.supabase.table('dimmer').select('*').execute()
        stats['dimmer'] = len(dimmer.data) if dimmer.data else 0
        
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
        profili = db.supabase.table('profili').select('*').execute()
        categorie = db.supabase.table('categorie').select('*').execute()
        
        return render_template('admin/profili.html', 
                             profili=profili.data or [], 
                             categorie=categorie.data or [])
    except Exception as e:
        logging.error(f"Errore caricamento profili: {str(e)}")
        flash('Errore nel caricamento dei profili', 'error')
        return render_template('admin/profili.html', profili=[], categorie=[])

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

# =========================
# GESTIONE STRIP LED
# =========================

@admin_bp.route('/strip_led')
def strip_led():
    auth_check = require_admin_login()
    if auth_check:
        return auth_check
    
    try:
        strips = db.supabase.table('strip_led').select('*').execute()
        return render_template('admin/strip_led.html', strips=strips.data or [])
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