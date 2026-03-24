import { useState } from "react";
import { trpc } from "../lib/trpc";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const sendLink = trpc.auth.sendMagicLink.useMutation({
    onSuccess: () => {
      setSent(true);
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6 text-center">

        {/* Title */}
        <div className="text-2xl font-semibold text-gray-800">
          2ndBrain
        </div>

        {/* Description */}
        <p className="text-sm text-gray-500 leading-relaxed">
          2ndBrain is a calm, minimal space for thinking.
          Capture ideas instantly, connect them effortlessly,
          and build a system that evolves with your thoughts.
        </p>

        {/* Input */}
        {!sent ? (
          <>
            <input
              type="email"
              placeholder="you@yourmind.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border p-3 text-sm rounded outline-none focus:ring-1 focus:ring-gray-400"
            />

            <button
              onClick={() => sendLink.mutate({ email })}
              className="w-full bg-black text-white text-sm py-3 rounded hover:opacity-90 transition"
            >
              Send magic link
            </button>
          </>
        ) : (
          <div className="text-sm text-gray-500">
            Check your email for your magic link ✉️
          </div>
        )}
      </div>
    </div>
  );
}