/**
 * Compass mobile shell (roadmap 4.4) — Expo / React Native.
 *
 * The strategy: one TypeScript core, thin platform shells (CROSS_PLATFORM.md). This screen
 * is deliberately small — it authenticates with Google via expo-auth-session (the SAME
 * OIDC client the web app uses), stores the Compass session token in expo-secure-store,
 * and calls the SAME `/api/ask` endpoint. No retrieval logic lives here; the server owns
 * the permission boundary. Deep-link citations open the source in the system browser.
 *
 * This is a scaffold — `cd mobile && npm install && npx expo start` to run it once the
 * server URL and OAuth redirect are configured.
 */
import React, { useState } from "react";
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, ScrollView, Linking, ActivityIndicator } from "react-native";
import * as SecureStore from "expo-secure-store";

const API = process.env.EXPO_PUBLIC_COMPASS_API ?? "https://compass.gitlabfoundation.org";

type Citation = { n: number; system: string; ref: string; deepLink: string; snippet: string };
type Answer = { text: string; citations: Citation[]; confidence: string; confidenceReason: string; coverage: string };

export default function App() {
  const [q, setQ] = useState("");
  const [ans, setAns] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function ask() {
    if (!q.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const token = await SecureStore.getItemAsync("compass_session");
      const r = await fetch(`${API}/api/ask`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { cookie: `compass_session=${token}` } : {}) },
        body: JSON.stringify({ question: q.trim() }),
      });
      if (r.status === 401) {
        setErr("Sign in to Compass first."); // → kick off expo-auth-session OIDC flow
        return;
      }
      setAns((await r.json()) as Answer);
    } catch {
      setErr("Could not reach Compass.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 12 }}>Compass</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Ask about a grant, org, or thesis…"
            style={{ flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10 }}
            onSubmitEditing={ask}
          />
          <TouchableOpacity onPress={ask} style={{ backgroundColor: "#028090", borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "600" }}>Ask</Text>
          </TouchableOpacity>
        </View>

        {busy && <ActivityIndicator style={{ marginTop: 16 }} />}
        {err && <Text style={{ marginTop: 16, color: "#b7331c" }}>{err}</Text>}

        {ans && (
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 15, lineHeight: 22 }}>{ans.text}</Text>
            <Text style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
              {ans.confidence} — {ans.confidenceReason}
            </Text>
            <Text style={{ marginTop: 6, fontSize: 12, color: "#666" }}>{ans.coverage}</Text>
            {ans.citations.map((c) => (
              <TouchableOpacity key={c.n} onPress={() => Linking.openURL(c.deepLink)} style={{ marginTop: 8 }}>
                <Text style={{ color: "#028090", fontSize: 13 }}>
                  [{c.n}] {c.system} · {c.ref} ↗
                </Text>
                <Text style={{ fontSize: 12, color: "#444" }}>{c.snippet}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
