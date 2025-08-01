// js/reset-password.js
import { supabase } from '../shared/js/supabaseClient.js';

const errorDiv       = document.getElementById('error');
const formDiv        = document.getElementById('form');
const successDiv     = document.getElementById('success');
const newPasswordIn  = document.getElementById('newPassword');
const updateBtn      = document.getElementById('updateBtn');
const gotoLoginBtn   = document.getElementById('gotoLogin');

async function init() {
  // 1. Parse the recovery token and automatically sign the user in
  const { data: { session }, error } = await supabase.auth.getSessionFromUrl({ storeSession: true });
  if (error || !session) {
    errorDiv.textContent = 'Invalid or expired link.';
    formDiv.style.display = 'none';
    return;
  }
  // If we have a session, show the form (it’s already visible)
}

async function updatePassword() {
  errorDiv.textContent = '';
  const newPassword = newPasswordIn.value.trim();
  if (!newPassword) {
    errorDiv.textContent = 'Please enter a new password.';
    return;
  }

  // 2. Update the user’s password
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    errorDiv.textContent = error.message;
  } else {
    formDiv.style.display    = 'none';
    successDiv.style.display = '';
  }
}

gotoLoginBtn?.addEventListener('click', () => {
  window.location.href = 'login.html';
});
updateBtn.addEventListener('click', updatePassword);

window.addEventListener('DOMContentLoaded', init);