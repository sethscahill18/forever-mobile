import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { createAccount } from '../../src/services/auth.service';
import { useAuthStore } from '../../src/store/auth.store';
import { db } from '../../src/db/database';
import { users } from '../../src/db/schema';
import { useAppTheme } from '../../src/store/appTheme.store';
import { ThemeColors } from '../../src/theme/tokens';

export default function CreateAccountScreen() {
  const [name,     setName]     = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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

        <View style={styles.inputRow}>
          <TextInput
            style={styles.inputFlex}
            placeholder="Enter username"
            value={name}
            onChangeText={setName}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.inputFlex}
            placeholder="Password (min 6 characters)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPw}
          />
          <Pressable onPress={() => setShowPw((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
            <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textMuted} />
          </Pressable>
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.inputFlex}
            placeholder="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!showPw}
          />
        </View>

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

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    inner:     { flex: 1, justifyContent: 'center', padding: 32 },
    title:     { fontSize: 28, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
    subtitle:  { fontSize: 15, color: colors.textMuted, marginBottom: 32 },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      marginBottom: 14,
    },
    inputFlex: {
      flex: 1,
      padding: 14,
      fontSize: 16,
      color: colors.textPrimary,
    },
    eyeBtn: {
      paddingHorizontal: 12,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
  });
}
