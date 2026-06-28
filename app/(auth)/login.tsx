import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { login, getCredentials } from '../../src/services/auth.service';
import { useAuthStore } from '../../src/store/auth.store';

export default function LoginScreen() {
  const [password,  setPassword]  = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  async function handleLogin() {
    if (!password) return Alert.alert('Enter your password');
    setLoading(true);
    try {
      const creds = await login(password);
      if (creds) {
        setAuth(creds.userId, creds.displayName);
      } else {
        Alert.alert('Incorrect password', 'Please try again.');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not log in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Enter your password to continue</Text>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.inputFlex}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPw}
            autoFocus
          />
          <Pressable onPress={() => setShowPw((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
            <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={22} color="#718096" />
          </Pressable>
        </View>

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Logging in…' : 'Log In'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FAFC' },
  inner:     { flex: 1, justifyContent: 'center', padding: 32 },
  title:     { fontSize: 28, fontWeight: '700', color: '#1A202C', marginBottom: 6 },
  subtitle:  { fontSize: 15, color: '#718096', marginBottom: 32 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    marginBottom: 14,
  },
  inputFlex: {
    flex: 1,
    padding: 14,
    fontSize: 16,
  },
  eyeBtn: {
    paddingHorizontal: 12,
  },
  button: {
    backgroundColor: '#4A90D9',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
