const auth = {
  user: null,
  profile: null,

  async init() {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
      this.user = session.user;
      await this._fetchProfile();
    }
    this._updateNav();

    db.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        this.user = session.user;
        await this._fetchProfile();
      } else {
        this.user    = null;
        this.profile = null;
      }
      this._updateNav();
    });
  },

  async _fetchProfile() {
    if (!this.user) return;
    const { data } = await db
      .from('users')
      .select('*')
      .eq('email', this.user.email)
      .maybeSingle();

    if (data) {
      this.profile = data;
      return;
    }

    const username = this.user.email.split('@')[0].replace(/[^a-z0-9_]/gi, '_');
    const { data: created } = await db.from('users').insert({
      username,
      email:         this.user.email,
      password_hash: 'managed_by_supabase_auth',
      role:          'customer',
      status:        'active'
    }).select().single();
    this.profile = created;
  },

  _updateNav() {
    const authLink = document.querySelector('.nav-auth');
    if (authLink) {
      if (this.user && this.profile) {
        authLink.textContent = this.profile.username;
        authLink.href = 'settings.html';
      } else if (this.user) {
        authLink.textContent = this.user.email.split('@')[0];
        authLink.href = 'settings.html';
      } else {
        authLink.textContent = 'Sign In';
        authLink.href = 'login.html';
      }
    }

    if (typeof cart !== 'undefined') cart.updateNavCount();
  },

  requireAuth() {
    if (!this.user) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },

  requireAdmin() {
    if (!this.user || this.profile?.role !== 'admin') {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  },

  async signOut() {
    await db.auth.signOut();
    window.location.href = 'index.html';
  }
};

function showToast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9999;
    padding:11px 20px; font-family:var(--mono); font-size:.75rem; font-weight:600;
    background:${type === 'err' ? '#ff4444' : 'var(--green)'};
    color:${type === 'err' ? '#fff' : '#000'};
    box-shadow:0 4px 20px rgba(0,0,0,.35);
    opacity:0; transition:opacity .2s;
  `;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.style.opacity = '1');
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 250);
  }, 3000);
}
