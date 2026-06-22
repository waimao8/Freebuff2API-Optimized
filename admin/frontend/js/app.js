const { createApp, ref, reactive, computed, onMounted, onUnmounted, watch } = Vue;

const app = createApp({
  setup() {
    // ========== Auth ==========
    const token = ref(localStorage.getItem('fba_token') || '');
    const initialized = ref(true);
    const checking = ref(true);
    const loginPassword = ref('');
    const setupPassword = ref('');
    const confirmPassword = ref('');
    const authLoading = ref(false);

    // ========== UI ==========
    const savedPage = sessionStorage.getItem('fba_page');
    const page = ref(savedPage && ['dashboard','accounts','keys','settings','logs','test'].includes(savedPage) ? savedPage : 'dashboard');
    const collapsed = ref(false);
    const toasts = reactive([]);
    const loading = ref(false);
    const saveLoading = ref(false);
    const ctlLoading = ref(false);

    const navItems = [
      { key: 'dashboard', label: '数据概览', icon: '◆' },
      { key: 'accounts', label: '账号管理', icon: '👤' },
      { key: 'keys', label: 'API Key', icon: '🔑' },
      { key: 'settings', label: '系统设置', icon: '⚙️' },
      { key: 'logs', label: '实时日志', icon: '▣' },
      { key: 'test', label: 'API 测试', icon: '▶' },
    ];

    // ========== Status & Data ==========
    const statusData = reactive({
      service: { active: false, uptime: 'N/A', name: 'freebuff2api' },
      accounts: { count: 0 },
      account_stats: null,
      config: { host: '0.0.0.0', port: 8000, debug: false, proxy_enabled: false, log_level: 'INFO' },
    });

    // ========== Accounts ==========
    const accounts = ref([]);
    const showAddModal = ref(false);
    const newAccountToken = ref('');
    const newAccountLabel = ref('');
    const showEditModal = ref(false);
    const editAccountIdx = ref(-1);
    const editAccountToken = ref('');
    const editAccountLabel = ref('');

    // ========== Settings ==========
    const settingsForm = reactive({
      FREEBUFF_TOKEN: '',
      FREEBUFF_API_BASE_URL: 'https://www.codebuff.com',
      FREEBUFF_AD_PROVIDERS: 'gravity,zeroclick',
      FREEBUFF_TIMEOUT: '60',
      FREEBUFF_PROXY_ENABLED: false,
      FREEBUFF_PROXY_URL: '',
      FREEBUFF_DEBUG: false,
      FREEBUFF_LOG_LEVEL: 'INFO',
      FREEBUFF_LOG_BODY_CHARS: '2000',
      FREEBUFF_LOG_COLOR: true,
      FREEBUFF_HOST: '0.0.0.0',
      FREEBUFF_PORT: '8000',
      FREEBUFF_TIMEZONE: 'Asia/Shanghai',
      FREEBUFF_LOCALE: 'zh-CN',
      FREEBUFF_OS: 'windows',
    });

    const proxyTesting = ref(false);
    const proxyTestResult = ref(null);

    // ========== API Keys ==========
    const apiKeys = ref([]);
    const newKeyLabel = ref('');
    const showNewKeyResult = ref(false);
    const newKeyValue = ref('');

    // ========== Logs ==========
    const logConnected = ref(false);
    const logLines = ref([]);
    let logEventSource = null;

    // ========== Test ==========
    const testModel = ref('deepseek/deepseek-v4-flash');
    const testMessages = ref([]);
    const testInput = ref('');
    const testLoading = ref(false);
    const testSystem = ref('You are a helpful assistant.');

    const models = [
      'deepseek/deepseek-v4-flash',
      'deepseek/deepseek-v4-pro',
      'moonshotai/kimi-k2.6',
      'minimax/minimax-m2.7',
      'minimax/minimax-m3',
      'google/gemini-2.5-flash-lite',
      'google/gemini-3.1-flash-lite-preview',
      'google/gemini-3.1-pro-preview',
      'mimo/mimo-v2.5',
      'mimo/mimo-v2.5-pro',
    ];

    // ========== Computed ==========
    const isLoggedIn = computed(() => !!token.value);
    const showSetup = computed(() => !initialized.value);
    const showLogin = computed(() => initialized.value && !isLoggedIn.value);
    const showApp = computed(() => isLoggedIn.value);

    // ========== Helpers ==========
    const apiBase = '';

    async function request(path, opt = {}) {
      const url = `${apiBase}${path}`;
      const headers = { 'Content-Type': 'application/json', ...(opt.headers || {}) };
      if (token.value) headers['Authorization'] = `Bearer ${token.value}`;
      try {
        const res = await fetch(url, { ...opt, headers });
        if (res.status === 401) {
          token.value = '';
          localStorage.removeItem('fba_token');
          showToast('登录已过期，请重新登录', 'error');
          throw new Error('Unauthorized');
        }
        if (!res.ok) {
          let text = '';
          try { text = await res.text(); } catch(e){}
          throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
        }
        return await res.json();
      } catch (e) {
        console.error(e);
        throw e;
      }
    }

    function showToast(msg, type = 'info') {
      const id = Date.now() + Math.random();
      toasts.push({ id, msg, type });
      setTimeout(() => {
        const idx = toasts.findIndex(t => t.id === id);
        if (idx > -1) toasts.splice(idx, 1);
      }, 3000);
    }

    async function copyText(text) {
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        showToast('已复制', 'success');
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
        showToast('已复制', 'success');
      }
    }

    // ========== Auth actions ==========
    async function checkAuth() {
      checking.value = true;
      try {
        const res = await request('/api/auth/status', { method: 'POST' });
        initialized.value = res.initialized;
      } catch (e) {
        showToast('无法连接后端', 'error');
      } finally {
        checking.value = false;
      }
    }

    async function doSetup() {
      if (!setupPassword.value) return showToast('请输入密码', 'error');
      if (setupPassword.value.length < 6) return showToast('密码至少6位', 'error');
      if (setupPassword.value !== confirmPassword.value) return showToast('两次密码不一致', 'error');
      authLoading.value = true;
      try {
        const res = await request('/api/auth/setup', { method: 'POST', body: JSON.stringify({ password: setupPassword.value }) });
        token.value = res.token;
        localStorage.setItem('fba_token', res.token);
        initialized.value = true;
        showToast('初始化成功', 'success');
      } catch (e) {
        showToast(e.message || '初始化失败', 'error');
      } finally {
        authLoading.value = false;
      }
    }

    async function doLogin() {
      if (!loginPassword.value) return showToast('请输入密码', 'error');
      authLoading.value = true;
      try {
        const res = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ password: loginPassword.value }) });
        token.value = res.token;
        localStorage.setItem('fba_token', res.token);
        showToast('登录成功', 'success');
      } catch (e) {
        showToast(e.message || '密码错误', 'error');
      } finally {
        authLoading.value = false;
      }
    }

    function doLogout() {
      token.value = '';
      localStorage.removeItem('fba_token');
      showToast('已退出登录', 'info');
    }

    // ========== Dashboard ==========
    async function loadStatus() {
      loading.value = true;
      try {
        const data = await request('/api/status');
        Object.assign(statusData, data);
      } catch (e) {}
      loading.value = false;
    }

    async function toggleService() {
      ctlLoading.value = true;
      try {
        const action = statusData.service.active ? 'stop' : 'start';
        const res = await request(`/api/control/${action}`, { method: 'POST' });
        if (!res.ok) {
          showToast(res.error || '操作失败', 'error');
        } else {
          showToast(statusData.service.active ? '服务已停止' : '服务已启动', 'success');
        }
        await new Promise(r => setTimeout(r, 1000));
        await loadStatus();
      } catch (e) { showToast(e.message || '操作失败', 'error'); }
      ctlLoading.value = false;
    }

    async function restartService() {
      if (!confirm('确定要重启 Freebuff2API 服务吗？')) return;
      ctlLoading.value = true;
      try {
        const res = await request('/api/control/restart', { method: 'POST' });
        showToast(res.ok ? '服务已重启' : (res.error || '重启失败'), res.ok ? 'success' : 'error');
        await new Promise(r => setTimeout(r, 1500));
        await loadStatus();
      } catch (e) { showToast(e.message || '重启失败', 'error'); }
      ctlLoading.value = false;
    }

    // ========== Accounts ==========
    function getAccountTests() {
      try { return JSON.parse(localStorage.getItem('fba_account_tests') || '{}'); } catch(e) { return {}; }
    }
    function setAccountTests(obj) {
      localStorage.setItem('fba_account_tests', JSON.stringify(obj));
    }

    async function loadAccounts() {
      loading.value = true;
      try {
        const data = await request('/api/accounts');
        const cached = getAccountTests();
        accounts.value = (data.accounts || []).map((a, i) => ({ ...a, id: i, testing: false, testResult: cached[a.token] || null }));
      } catch (e) {}
      loading.value = false;
    }

    async function saveAccounts() {
      saveLoading.value = true;
      try {
        const payload = accounts.value.map(a => ({ token: a.token, label: a.label || '', active: true }));
        await request('/api/accounts', { method: 'POST', body: JSON.stringify({ accounts: payload }) });
        showToast('账号已保存', 'success');
      } catch (e) {
        showToast(e.message || '保存失败', 'error');
      }
      saveLoading.value = false;
    }

    function addAccount() {
      newAccountToken.value = '';
      newAccountLabel.value = '';
      showAddModal.value = true;
    }

    async function confirmAddAccount() {
      if (!newAccountToken.value.trim()) {
        showToast('请输入 Token', 'error');
        return;
      }
      accounts.value.push({
        id: accounts.value.length,
        token: newAccountToken.value.trim(),
        label: newAccountLabel.value.trim() || (`账号 ${accounts.value.length + 1}`),
        active: true,
        testing: false,
        testResult: null,
      });
      showAddModal.value = false;
      await saveAccounts();
    }

    function openEditAccount(acc, idx) {
      editAccountIdx.value = idx;
      editAccountToken.value = acc.token;
      editAccountLabel.value = acc.label || '';
      showEditModal.value = true;
    }

    async function confirmEditAccount() {
      const idx = editAccountIdx.value;
      if (idx < 0 || idx >= accounts.value.length) return;
      if (!editAccountToken.value.trim()) {
        showToast('请输入 Token', 'error');
        return;
      }
      const oldToken = accounts.value[idx].token;
      const newToken = editAccountToken.value.trim();
      accounts.value[idx].label = editAccountLabel.value.trim() || accounts.value[idx].label;
      accounts.value[idx].token = newToken;
      showEditModal.value = false;
      await saveAccounts();
      if (oldToken !== newToken) {
        const cached = getAccountTests();
        if (cached[oldToken]) {
          cached[newToken] = cached[oldToken];
          delete cached[oldToken];
          setAccountTests(cached);
        }
      }
      showToast('账号已更新', 'success');
    }

    async function removeAccount(idx) {
      if (!confirm('确定删除该账号？')) return;
      const tok = accounts.value[idx]?.token;
      accounts.value.splice(idx, 1);
      // re-index
      accounts.value.forEach((a, i) => a.id = i);
      await saveAccounts();
      if (tok) {
        const cached = getAccountTests();
        delete cached[tok];
        setAccountTests(cached);
      }
    }

    async function testAccount(acc) {
      acc.testing = true;
      acc.testResult = null;
      try {
        const res = await request('/api/accounts/test', { method: 'POST', body: JSON.stringify({ token: acc.token }) });
        acc.testResult = res;
      } catch (e) {
        acc.testResult = { valid: false, error: String(e) };
      }
      acc.testing = false;
      const cached = getAccountTests();
      cached[acc.token] = acc.testResult;
      setAccountTests(cached);
    }

    async function refreshAccounts() {
      await loadAccounts();
      if (!accounts.value.length) {
        showToast('暂无账号', 'info');
        return;
      }
      let passed = 0, failed = 0;
      for (const acc of accounts.value) {
        await testAccount(acc);
        if (acc.testResult && acc.testResult.valid) passed++;
        else failed++;
      }
      showToast(`测试完成：${passed} 个正常，${failed} 个异常`, 'success');
    }

    // ========== Settings ==========
    async function loadSettings() {
      loading.value = true;
      try {
        const data = await request('/api/config');
        const env = data.env || {};
        settingsForm.FREEBUFF_TOKEN = env.FREEBUFF_TOKEN || '';
        settingsForm.FREEBUFF_API_BASE_URL = env.FREEBUFF_API_BASE_URL || 'https://www.codebuff.com';
        settingsForm.FREEBUFF_AD_PROVIDERS = env.FREEBUFF_AD_PROVIDERS || 'gravity,zeroclick';
        settingsForm.FREEBUFF_TIMEOUT = env.FREEBUFF_TIMEOUT || '60';
        settingsForm.FREEBUFF_PROXY_ENABLED = (env.FREEBUFF_PROXY_ENABLED || '').toLowerCase() === 'true';
        settingsForm.FREEBUFF_PROXY_URL = env.FREEBUFF_PROXY_URL || '';
        settingsForm.FREEBUFF_DEBUG = (env.FREEBUFF_DEBUG || '').toLowerCase() === 'true';
        settingsForm.FREEBUFF_LOG_LEVEL = env.FREEBUFF_LOG_LEVEL || 'INFO';
        settingsForm.FREEBUFF_LOG_BODY_CHARS = env.FREEBUFF_LOG_BODY_CHARS || '2000';
        settingsForm.FREEBUFF_LOG_COLOR = (env.FREEBUFF_LOG_COLOR || '').toLowerCase() !== 'false';
        settingsForm.FREEBUFF_HOST = env.FREEBUFF_HOST || '0.0.0.0';
        settingsForm.FREEBUFF_PORT = env.FREEBUFF_PORT || '8000';
        settingsForm.FREEBUFF_TIMEZONE = env.FREEBUFF_TIMEZONE || 'Asia/Shanghai';
        settingsForm.FREEBUFF_LOCALE = env.FREEBUFF_LOCALE || 'zh-CN';
        settingsForm.FREEBUFF_OS = env.FREEBUFF_OS || 'windows';
        const cachedProxy = localStorage.getItem('fba_proxy_test');
        if (cachedProxy) {
          try {
            const p = JSON.parse(cachedProxy);
            if (p && p.url === settingsForm.FREEBUFF_PROXY_URL) proxyTestResult.value = p.result;
          } catch (_) {}
        }
      } catch (e) {}
      loading.value = false;
    }

    async function saveSettings() {
      saveLoading.value = true;
      try {
        const env = {
          FREEBUFF_TOKEN: settingsForm.FREEBUFF_TOKEN,
          FREEBUFF_API_BASE_URL: settingsForm.FREEBUFF_API_BASE_URL,
          FREEBUFF_AD_PROVIDERS: settingsForm.FREEBUFF_AD_PROVIDERS,
          FREEBUFF_TIMEOUT: String(settingsForm.FREEBUFF_TIMEOUT),
          FREEBUFF_PROXY_ENABLED: settingsForm.FREEBUFF_PROXY_ENABLED ? 'true' : 'false',
          FREEBUFF_PROXY_URL: settingsForm.FREEBUFF_PROXY_URL || '',
          FREEBUFF_DEBUG: settingsForm.FREEBUFF_DEBUG ? 'true' : 'false',
          FREEBUFF_LOG_LEVEL: settingsForm.FREEBUFF_LOG_LEVEL,
          FREEBUFF_LOG_BODY_CHARS: String(settingsForm.FREEBUFF_LOG_BODY_CHARS),
          FREEBUFF_LOG_COLOR: settingsForm.FREEBUFF_LOG_COLOR ? 'true' : 'false',
          FREEBUFF_HOST: settingsForm.FREEBUFF_HOST,
          FREEBUFF_PORT: String(settingsForm.FREEBUFF_PORT),
          FREEBUFF_TIMEZONE: settingsForm.FREEBUFF_TIMEZONE,
          FREEBUFF_LOCALE: settingsForm.FREEBUFF_LOCALE,
          FREEBUFF_OS: settingsForm.FREEBUFF_OS,
        };
        await request('/api/config', { method: 'POST', body: JSON.stringify({ env }) });
        showToast('配置已保存', 'success');
      } catch (e) {
        showToast(e.message || '保存失败', 'error');
      }
      saveLoading.value = false;
    }

    // ========== Logs ==========
    function connectLog() {
      disconnectLog();
      const url = `${location.protocol}//${location.host}/api/logs/sse?token=${encodeURIComponent(token.value)}`;
      logEventSource = new EventSource(url);
      logConnected.value = true;
      logEventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.line !== undefined) {
            logLines.value.push(data.line);
            if (logLines.value.length > 2000) logLines.value = logLines.value.slice(-1500);
          }
        } catch (_) { logLines.value.push(e.data); }
      };
      logEventSource.onerror = () => { logConnected.value = false; };
    }

    function disconnectLog() {
      if (logEventSource) { logEventSource.close(); logEventSource = null; }
      logConnected.value = false;
    }

    function toggleLog() { logConnected.value ? disconnectLog() : connectLog(); }
    function clearLog() { logLines.value = []; }

    // ========== Test ==========
    async function sendTest() {
      if (!testInput.value.trim()) return;
      const userMsg = { role: 'user', content: testInput.value.trim() };
      testMessages.value.push({ role: 'user', content: userMsg.content });
      testInput.value = '';
      testLoading.value = true;

      const messages = [];
      if (testSystem.value) messages.push({ role: 'system', content: testSystem.value });
      messages.push(userMsg);

      try {
        const res = await request('/api/test/chat', {
          method: 'POST',
          body: JSON.stringify({ model: testModel.value, messages })
        });
        if (res.error) {
          testMessages.value.push({ role: 'assistant', content: `错误: ${res.error}` });
        } else {
          const content = res.choices?.[0]?.message?.content || '(空响应)';
          testMessages.value.push({ role: 'assistant', content });
        }
      } catch (e) {
        testMessages.value.push({ role: 'assistant', content: `错误: ${e.message}` });
      }
      testLoading.value = false;
    }

    function clearChat() { testMessages.value = []; }

    async function testProxy() {
      const url = settingsForm.FREEBUFF_PROXY_URL?.trim();
      if (!url) {
        showToast('请先填写代理地址', 'error');
        return;
      }
      proxyTesting.value = true;
      proxyTestResult.value = null;
      try {
        const res = await request('/api/test/proxy', {
          method: 'POST',
          body: JSON.stringify({ proxy_url: url })
        });
        proxyTestResult.value = res;
        if (res.ok) {
          showToast(`代理测试通过，延迟 ${res.latency_ms}ms`, 'success');
        } else {
          showToast(`代理测试失败: ${res.error || '未知错误'}`, 'error');
        }
      } catch (e) {
        proxyTestResult.value = { ok: false, error: e.message };
        showToast(`代理测试失败: ${e.message}`, 'error');
      }
      if (proxyTestResult.value) {
        localStorage.setItem('fba_proxy_test', JSON.stringify({ url: settingsForm.FREEBUFF_PROXY_URL, result: proxyTestResult.value }));
      }
      proxyTesting.value = false;
    }

    // ========== API Keys ==========
    async function loadApiKeys() {
      loading.value = true;
      try {
        const data = await request('/api/keys');
        apiKeys.value = data.keys || [];
      } catch (e) {}
      loading.value = false;
    }

    async function createApiKey() {
      saveLoading.value = true;
      try {
        const res = await request('/api/keys', {
          method: 'POST',
          body: JSON.stringify({ label: newKeyLabel.value })
        });
        if (res.ok && res.key) {
          newKeyValue.value = res.key;
          showNewKeyResult.value = true;
          showToast('API Key 已创建，请立即复制保存', 'success');
          await loadApiKeys();
        }
      } catch (e) {
        showToast(e.message || '创建失败', 'error');
      }
      saveLoading.value = false;
    }

    async function toggleApiKey(keyId, currentEnabled) {
      try {
        await request(`/api/keys/${keyId}`, {
          method: 'PATCH',
          body: JSON.stringify({ enabled: !currentEnabled })
        });
        await loadApiKeys();
      } catch (e) {
        showToast(e.message || '操作失败', 'error');
      }
    }

    async function deleteApiKey(keyId) {
      if (!confirm('确定删除该 API Key？删除后使用该 Key 的调用将失败。')) return;
      try {
        await request(`/api/keys/${keyId}`, { method: 'DELETE' });
        await loadApiKeys();
        showToast('已删除', 'success');
      } catch (e) {
        showToast(e.message || '删除失败', 'error');
      }
    }

    function dismissNewKey() {
      showNewKeyResult.value = false;
      newKeyValue.value = '';
      newKeyLabel.value = '';
    }

    // ========== Lifecycle ==========
    onMounted(async () => {
      await checkAuth();
      if (isLoggedIn.value) {
        await loadStatus();
        if (page.value === 'accounts') await loadAccounts();
        if (page.value === 'settings') await loadSettings();
      }
    });

    onUnmounted(() => { disconnectLog(); });

    watch(page, (p) => {
      sessionStorage.setItem('fba_page', p);
      if (p === 'dashboard') loadStatus();
      if (p === 'accounts') loadAccounts();
      if (p === 'keys') loadApiKeys();
      if (p === 'settings') loadSettings();
      if (p !== 'logs') disconnectLog();
    });

    return {
      token, initialized, checking, loginPassword, setupPassword, confirmPassword, authLoading,
      page, collapsed, toasts, loading, saveLoading, ctlLoading, navItems,
      statusData, accounts, showAddModal, newAccountToken, newAccountLabel,
      showEditModal, editAccountIdx, editAccountToken, editAccountLabel,
      settingsForm, logConnected, logLines,
      proxyTesting, proxyTestResult,
      apiKeys, newKeyLabel, showNewKeyResult, newKeyValue,
      testModel, testMessages, testInput, testLoading, testSystem, models,
      isLoggedIn, showSetup, showLogin, showApp,
      checkAuth, doSetup, doLogin, doLogout,
      loadStatus, toggleService, restartService,
      loadAccounts, refreshAccounts, saveAccounts, addAccount, confirmAddAccount, openEditAccount, confirmEditAccount, removeAccount, testAccount,
      loadSettings, saveSettings,
      connectLog, disconnectLog, toggleLog, clearLog,
      sendTest, clearChat, testProxy, copyText, showToast,
      loadApiKeys, createApiKey, toggleApiKey, deleteApiKey, dismissNewKey,
    };
  },

  template: `
<div v-if="checking" class="login-wrap">
  <div class="login-card" style="text-align:center">
    <div class="spinner" style="width:28px;height:28px;margin:0 auto 12px"></div>
    <p>检查服务状态中...</p>
  </div>
</div>

<!-- Setup -->
<div v-else-if="showSetup" class="login-wrap">
  <div class="login-card">
    <h2>初始化密码</h2>
    <p class="subtitle">设置 Freebuff2API 管理面板登录密码</p>
    <div class="form-group">
      <input v-model="setupPassword" type="password" class="login-input" placeholder="输入密码（至少6位）" />
    </div>
    <div class="form-group">
      <input v-model="confirmPassword" type="password" class="login-input" placeholder="确认密码" />
    </div>
    <button class="login-btn" :disabled="authLoading" @click="doSetup">
      <span v-if="authLoading" class="spinner"></span>
      <span v-else>初始化</span>
    </button>
  </div>
</div>

<!-- Login -->
<div v-else-if="showLogin" class="login-wrap">
  <div class="login-card">
    <h2>管理面板登录</h2>
    <p class="subtitle">Freebuff2API Admin</p>
    <div class="form-group">
      <input v-model="loginPassword" type="password" class="login-input" placeholder="输入密码" @keyup.enter="doLogin" />
    </div>
    <button class="login-btn" :disabled="authLoading" @click="doLogin">
      <span v-if="authLoading" class="spinner"></span>
      <span v-else>登录</span>
    </button>
  </div>
</div>

<!-- App -->
<div v-else class="layout">
  <!-- Sider -->
  <div class="sider" :class="{collapsed}">
    <div class="sider-logo">
      <img src="/logo-icon.webp" alt="logo" class="logo-icon" />
      <span class="text">Freebuff2API</span>
    </div>
    <div class="sider-menu">
      <div v-for="item in navItems" :key="item.key" class="menu-item" :class="{active: page===item.key}" @click="page=item.key">
        <span class="icon">{{item.icon}}</span>
        <span class="label">{{item.label}}</span>
      </div>
    </div>
    <div class="collapse-btn" @click="collapsed=!collapsed">
      {{ collapsed ? '→' : '←' }}
    </div>
  </div>

  <!-- Main -->
  <div class="main">
    <div class="header">
      <div class="header-left">
        <span class="text-secondary">{{ navItems.find(n=>n.key===page)?.label }}</span>
      </div>
      <div class="header-right">
        <span v-if="statusData.service.active" class="tag tag-success">● {{ statusData.service.name }} 运行中</span>
        <span v-else class="tag tag-error">● {{ statusData.service.name }} 已停止</span>
        <span class="icon-btn" @click="doLogout" title="退出">🚪</span>
      </div>
    </div>

    <div class="content">
      <!-- Dashboard -->
      <div v-if="page==='dashboard'">
        <div class="page-header">
          <div class="page-title">数据概览</div>
          <div class="actions">
            <button class="btn" :disabled="loading" @click="loadStatus">刷新</button>
            <button class="btn" :disabled="ctlLoading" @click="toggleService">{{ statusData.service.active ? '停止服务' : '启动服务' }}</button>
            <button class="btn primary" :disabled="ctlLoading" @click="restartService">重启服务</button>
          </div>
        </div>
        <div class="card-grid">
          <div class="stat-card">
            <div class="stat-label">服务状态</div>
            <div class="stat-value" :style="{color: statusData.service.active ? 'var(--success)' : 'var(--danger)'}">{{ statusData.service.active ? '运行中' : '已停止' }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">账号数量</div>
            <div class="stat-value">{{ statusData.accounts.count }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">API Key</div>
            <div class="stat-value">{{ statusData.api_keys?.enabled_count || 0 }} <span style="font-size:12px;color:var(--text-secondary)">/ {{ statusData.api_keys?.count || 0 }}</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-label">运行时长</div>
            <div class="stat-value" style="font-size:18px">{{ statusData.service.uptime }}</div>
          </div>
        </div>
        <div class="page-title" style="margin-top:24px">配置摘要</div>
        <div class="table-wrap">
          <div class="table-row"><div style="width:180px;color:var(--text-secondary)">API 地址</div><div>{{ statusData.config.api_address }}</div></div>
          <div class="table-row"><div style="width:180px;color:var(--text-secondary)">上游地址</div><div>{{ statusData.config.host }}:{{ statusData.config.port }}</div></div>
          <div class="table-row"><div style="width:180px;color:var(--text-secondary)">日志级别</div><div>{{ statusData.config.log_level }}</div></div>
          <div class="table-row"><div style="width:180px;color:var(--text-secondary)">代理</div><div>{{ statusData.config.proxy_enabled ? '已开启' : '已关闭' }}</div></div>
          <div class="table-row"><div style="width:180px;color:var(--text-secondary)">调试模式</div><div>{{ statusData.config.debug ? '已开启' : '已关闭' }}</div></div>
        </div>

        <!-- Account stats -->
        <div v-if="statusData.account_stats" style="margin-top:24px">
          <div class="page-title">账号轮询统计</div>
          <div class="table-wrap">
            <div class="table-header">
              <div style="width:60px">#</div>
              <div style="width:100px">状态</div>
              <div style="width:100px">使用次数</div>
              <div style="flex:1">最近模型</div>
              <div style="width:160px">最近使用</div>
            </div>
            <div v-for="(st, idx) in statusData.account_stats.accounts" :key="idx" class="table-row">
              <div style="width:60px">{{ idx + 1 }}</div>
              <div style="width:100px">
                <span v-if="st.busy" class="tag tag-warning">● 处理中</span>
                <span v-else-if="st.use_count > 0" class="tag tag-success">空闲</span>
                <span v-else class="tag" style="background:#f5f5f5;border-color:#d9d9d9;color:var(--text-secondary)">未使用</span>
              </div>
              <div style="width:100px">{{ st.use_count }}</div>
              <div style="flex:1;font-family:monospace;font-size:12px">{{ st.last_model || '-' }}</div>
              <div style="width:160px;font-size:12px;color:var(--text-secondary)">
                <span v-if="st.last_used_at">{{ new Date(st.last_used_at * 1000).toLocaleString('zh-CN', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit'}) }}</span>
                <span v-else>-</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Accounts -->
      <div v-if="page==='accounts'">
        <div class="page-header">
          <div class="page-title">账号管理</div>
          <div class="actions">
            <button class="btn" :disabled="loading" @click="refreshAccounts">刷新</button>
            <button class="btn primary" @click="addAccount">添加账号</button>
          </div>
        </div>
        <div class="table-wrap">
          <div class="table-header">
            <div style="width:80px">ID</div>
            <div style="flex:1">账号名称</div>
            <div style="flex:2">净值</div>
            <div style="width:120px;text-align:right">操作</div>
          </div>
          <div v-for="(acc, idx) in accounts" :key="idx" class="table-row">
            <div style="width:80px">{{ idx + 1 }}</div>
            <div style="flex:1">{{ acc.label }}</div>
            <div style="flex:2;font-family:monospace;font-size:12px;color:var(--text-secondary)">
              {{ acc.token.slice(0, 12) }}...{{ acc.token.slice(-8) }}
              <span v-if="acc.testResult">
                <span v-if="acc.testResult.valid" class="tag tag-success" style="margin-left:8px">✅ 正常</span>
                <span v-else class="tag tag-error" style="margin-left:8px">❌ {{ acc.testResult.error }}</span>
              </span>
            </div>
            <div style="width:120px;text-align:right;display:flex;gap:6px;justify-content:flex-end">
              <button class="btn sm" :disabled="acc.testing" @click="testAccount(acc)">
                <span v-if="acc.testing" class="spinner"></span>
                <span v-else>测试</span>
              </button>
              <button class="btn sm" @click="openEditAccount(acc, idx)">编辑</button>
              <button class="btn sm danger" @click="removeAccount(idx)">删除</button>
            </div>
          </div>
          <div v-if="!accounts.length" style="padding:24px;text-align:center;color:var(--text-secondary)">暂无账号，请点击「添加账号」
          </div>
        </div>
      </div>

      <!-- API Keys -->
      <div v-if="page==='keys'">
        <div class="page-header">
          <div class="page-title">API Key 管理</div>
          <div class="actions">
            <button class="btn" :disabled="loading" @click="loadApiKeys">刷新</button>
            <button class="btn primary" @click="createApiKey">生成 Key</button>
          </div>
        </div>
        <div v-if="showNewKeyResult" class="alert alert-success" style="margin-bottom:16px;padding:16px;background:var(--primary-light);border-radius:8px">
          <div style="font-weight:600;margin-bottom:8px">🎉 API Key 已生成，请立即复制保存（关闭后无法再次查看）</div>
          <div style="font-family:monospace;font-size:16px;background:#fff;padding:8px 12px;border-radius:4px;margin-bottom:8px">{{ newKeyValue }}</div>
          <div style="display:flex;gap:8px">
            <button class="btn primary" @click="copyText(newKeyValue)">复制</button>
            <button class="btn" @click="dismissNewKey">关闭</button>
          </div>
        </div>
        <div class="table-wrap">
          <div class="table-header">
            <div style="flex:1">Key</div>
            <div style="flex:1">备注</div>
            <div style="width:100px">状态</div>
            <div style="width:120px">创建时间</div>
            <div style="width:120px;text-align:right">操作</div>
          </div>
          <div v-for="k in apiKeys" :key="k.id" class="table-row">
            <div style="flex:1;font-family:monospace;font-size:13px">{{ k.key }}</div>
            <div style="flex:1">{{ k.label || '-' }}</div>
            <div style="width:100px">
              <span v-if="k.enabled" class="tag tag-success">启用</span>
              <span v-else class="tag tag-error">禁用</span>
            </div>
            <div style="width:120px;font-size:12px;color:var(--text-secondary)">{{ k.created_at }}</div>
            <div style="width:120px;text-align:right;display:flex;gap:6px;justify-content:flex-end">
              <button class="btn sm" @click="toggleApiKey(k.id, k.enabled)">{{ k.enabled ? '禁用' : '启用' }}</button>
              <button class="btn sm danger" @click="deleteApiKey(k.id)">删除</button>
            </div>
          </div>
          <div v-if="!apiKeys.length" style="padding:24px;text-align:center;color:var(--text-secondary)">暂无 API Key，点击「生成 Key」创建</div>
        </div>
      </div>

      <!-- Settings -->
      <div v-if="page==='settings'">
        <div class="page-header">
          <div class="page-title">系统设置</div>
          <div class="actions">
            <button class="btn" :disabled="loading" @click="loadSettings">重置</button>
            <button class="btn primary" :disabled="saveLoading" @click="saveSettings">
              <span v-if="saveLoading" class="spinner"></span>
              <span v-else>保存配置</span>
            </button>
          </div>
        </div>
        <div class="table-wrap" style="padding:24px">
          <div class="form-row">
            <div class="form-group">
              <label>上游 API 根地址</label>
              <input v-model="settingsForm.FREEBUFF_API_BASE_URL" class="input" />
            </div>
            <div class="form-group">
              <label>广告 Provider</label>
              <input v-model="settingsForm.FREEBUFF_AD_PROVIDERS" class="input" />
              <div class="form-hint">英文逗号分隔，默认 gravity,zeroclick</div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>超时时间 (秒)</label>
              <input v-model="settingsForm.FREEBUFF_TIMEOUT" type="number" class="input" />
            </div>
            <div class="form-group">
              <label>日志级别</label>
              <select v-model="settingsForm.FREEBUFF_LOG_LEVEL" class="input">
                <option>DEBUG</option>
                <option>INFO</option>
                <option>WARNING</option>
                <option>ERROR</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>日志打印字符数</label>
              <input v-model="settingsForm.FREEBUFF_LOG_BODY_CHARS" type="number" class="input" />
              <div class="form-hint">0 表示不截断</div>
            </div>
            <div class="form-group">
              <label>时区</label>
              <input v-model="settingsForm.FREEBUFF_TIMEZONE" class="input" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>语言区域</label>
              <input v-model="settingsForm.FREEBUFF_LOCALE" class="input" />
            </div>
            <div class="form-group">
              <label>操作系统</label>
              <input v-model="settingsForm.FREEBUFF_OS" class="input" />
              <div class="form-hint">模拟客户端设备信息</div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>监听地址</label>
              <input v-model="settingsForm.FREEBUFF_HOST" class="input" />
            </div>
            <div class="form-group">
              <label>监听端口</label>
              <input v-model="settingsForm.FREEBUFF_PORT" type="number" class="input" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>代理设置</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:4px">
                <input v-model="settingsForm.FREEBUFF_PROXY_ENABLED" type="checkbox" />
                <span>启用上游代理</span>
              </label>
            </div>
            <div class="form-group" :style="!settingsForm.FREEBUFF_PROXY_ENABLED ? 'opacity:0.4' : ''">
              <label>代理地址</label>
              <input v-model="settingsForm.FREEBUFF_PROXY_URL" class="input" :disabled="!settingsForm.FREEBUFF_PROXY_ENABLED" placeholder="http://127.0.0.1:7890 或 socks5://..." />
              <div style="margin-top:8px;display:flex;align-items:center;gap:10px">
                <button class="btn" :disabled="proxyTesting || !settingsForm.FREEBUFF_PROXY_ENABLED" @click="testProxy">
                  <span v-if="proxyTesting" class="spinner"></span>
                  <span v-else>测试代理</span>
                </button>
                <span v-if="proxyTestResult && proxyTestResult.ok" class="tag tag-success">✅ 通过 · {{ proxyTestResult.latency_ms }}ms · HTTP {{ proxyTestResult.status_code }}</span>
                <span v-else-if="proxyTestResult && !proxyTestResult.ok" class="tag tag-error">❌ {{ proxyTestResult.error }}</span>
              </div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>调试模式</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:4px">
                <input v-model="settingsForm.FREEBUFF_DEBUG" type="checkbox" />
                <span>调试模式</span>
              </label>
              <div class="form-hint">开启后输出上游请求/响应详情</div>
            </div>
            <div class="form-group">
              <label>日志样式</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:4px">
                <input v-model="settingsForm.FREEBUFF_LOG_COLOR" type="checkbox" />
                <span>彩色日志</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Logs -->
      <div v-if="page==='logs'">
        <div class="page-header">
          <div class="page-title">实时日志</div>
          <div class="actions">
            <button class="btn" :class="{primary: logConnected}" @click="toggleLog">{{ logConnected ? '断开' : '连接' }}</button>
            <button class="btn" @click="clearLog">清空</button>
          </div>
        </div>
        <div class="log-box" ref="logBox">
          <div v-for="(line, i) in logLines" :key="i" class="log-line">{{ line }}</div>
          <div v-if="!logLines.length" style="color:#666;text-align:center;margin-top:40px">暂无日志，点击「连接」查看 journalctl 流</div>
        </div>
      </div>

      <!-- Test -->
      <div v-if="page==='test'">
        <div class="page-header">
          <div class="page-title">API 测试</div>
          <div class="actions">
            <button class="btn" @click="clearChat">清空</button>
          </div>
        </div>
        <div class="form-row" style="margin-bottom:16px">
          <div class="form-group" style="flex:1">
            <label>模型</label>
            <select v-model="testModel" class="input">
              <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
          <div class="form-group" style="flex:2">
            <label>系统提示词</label>
            <input v-model="testSystem" class="input" placeholder="系统提示词（可留空）" />
          </div>
        </div>
        <div class="chat-box">
          <div v-for="(msg, i) in testMessages" :key="i" class="chat-msg" :class="msg.role">
            <div class="role">{{ msg.role === 'user' ? '用户' : 'AI' }}</div>
            <div class="txt">{{ msg.content }}</div>
          </div>
          <div v-if="testLoading" style="color:var(--text-secondary)">AI 思考中...</div>
        </div>
        <div style="display:flex;gap:8px">
          <input v-model="testInput" class="input" placeholder="输入测试消息..." @keyup.enter="sendTest" />
          <button class="btn primary" :disabled="testLoading" @click="sendTest" style="flex-shrink:0">
            <span v-if="testLoading" class="spinner"></span>
            <span v-else>发送</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Toast -->
<div class="toast-wrap">
  <div v-for="t in toasts" :key="t.id" class="toast" :class="'toast-' + t.type">
    {{ t.msg }}
  </div>
</div>

<!-- Add Account Modal -->
<div v-if="showAddModal" class="modal-backdrop" @click.self="showAddModal=false">
  <div class="modal-card">
    <div class="modal-title">添加账号</div>
    <div class="form-group">
      <label>账号名称</label>
      <input v-model="newAccountLabel" class="input" placeholder="例如：帐号1" />
    </div>
    <div class="form-group">
      <label>Freebuff Token</label>
      <textarea v-model="newAccountToken" class="input" rows="3" placeholder="粘贴 Bearer token 本体，不带 Bearer 前缀"></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn" @click="showAddModal=false">取消</button>
      <button class="btn primary" @click="confirmAddAccount">确认添加</button>
    </div>
  </div>
</div>

<!-- Edit Account Modal -->
<div v-if="showEditModal" class="modal-backdrop" @click.self="showEditModal=false">
  <div class="modal-card">
    <div class="modal-title">编辑账号</div>
    <div class="form-group">
      <label>账号名称</label>
      <input v-model="editAccountLabel" class="input" placeholder="例如：帐号1" />
    </div>
    <div class="form-group">
      <label>Freebuff Token</label>
      <textarea v-model="editAccountToken" class="input" rows="3" placeholder="粘贴 Bearer token 本体，不带 Bearer 前缀"></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn" @click="showEditModal=false">取消</button>
      <button class="btn primary" @click="confirmEditAccount">保存修改</button>
    </div>
  </div>
</div>
  `
});

app.mount('#app');
