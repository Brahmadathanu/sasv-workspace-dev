// js/login.js
import { supabase } from '../shared/js/supabaseClient.js';

const emailInput    = document.getElementById('email');
const passwordInput = document.getElementById('password');
const signInBtn     = document.getElementById('signInBtn');
const signUpBtn     = document.getElementById('signUpBtn');
const resetBtn      = document.getElementById('resetBtn');
const errorMsg      = document.getElementById('errorMsg');

async function checkSession() {
  const { data:{ session } } = await supabase.auth.getSession();
  if (session) {
    window.location.href = 'index.html';
  }
}

async function signIn() {
  errorMsg.textContent = '';
  const { error } = await supabase.auth.signInWithPassword({
    email:    emailInput.value.trim(),
    password: passwordInput.value
  });
  if (error) {
    errorMsg.textContent = error.message;
  } else {
    window.location.href = 'index.html';
  }
}

async function signUp() {
  errorMsg.textContent = '';
  const { error } = await supabase.auth.signUp({
    email:    emailInput.value.trim(),
    password: passwordInput.value
  });
  if (error) {
    errorMsg.textContent = error.message;
  } else {
    // automatically sign in after sign up
    await signIn();
  }
}

async function resetPassword() {
  errorMsg.textContent = '';

  const email = emailInput.value.trim();
  if (!email) {
    errorMsg.textContent = 'Please enter your email address.';
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(
    email,
    {
      // must match your Supabase Redirect URL
      redirectTo: 'http://localhost:3000/reset-password.html'
    }
  );

  if (error) {
    errorMsg.textContent = error.message;
  } else {
    errorMsg.textContent = 'Password reset link sent to your email.';
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  // 1) Clear any existing session so app always shows the login page
  await supabase.auth.signOut();

  // 2) Then check if someone is still signed in
  await checkSession();

  // 3) Wire up button clicks
  signInBtn.addEventListener('click', signIn);
  signUpBtn.addEventListener('click', signUp);
  resetBtn.addEventListener('click', resetPassword);

  // 4) Allow pressing Enter in either field to trigger Sign In
  emailInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      signIn();
    }
  });
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      signIn();
    }
  });
});