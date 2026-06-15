import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { createAccount } from '../../src/services/auth.service';
import { useAuthStore } from '../../src/store/auth.store';
import { db } from '../../src/db/database';
import { users } from '../../src/db/schema';

export default function CreateAccountScreen() {
  const [name,     setName]     = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  async function handleCreate() {
    if (!name.trim())                  return Alert.alert('Name required');
    if (password.length < 6)           return Alert.alert('Password must be at least 6 characters');
    if (password !== confirm)          return Alert.alert('Passwords do not match');

    setLoading(true);
    try {
      const userId = await createAccount(name.trim(), password);
      await db.insert(users).values({
        id: userId, displayName: name.trim(), createdAt: Date.now(),
      });
      setAuth(userId, name.trim());
    } catch (e) {
      console.error('createAccount failed:', e);
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
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
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Set up your Forever profile</Text>

        <TextInput
          style={styles.input}
          placeholder="Your name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          placeholder="Password (min 6 characters)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Creating…' : 'Create Account'}
          </Text>
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
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 14,
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
