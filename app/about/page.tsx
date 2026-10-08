"use client";

import React, { useState } from "react";
import { LandingPage } from "../components/landing-page";
import { AuthModal } from "../components/auth-modal";

export default function AboutPage() {
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <>
      <LandingPage
        onStartLearning={() => setShowAuthModal(true)}
        onSignIn={() => setShowAuthModal(true)}
      />
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
}
