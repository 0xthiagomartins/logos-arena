"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import RequireAuthModal from "@/components/require-auth-modal";
import { hasAnonymousTrialUsed } from "@/lib/local-gallery";

type NewDebateLinkProps = {
  className: string;
  children: React.ReactNode;
};

export default function NewDebateLink({ className, children }: NewDebateLinkProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      setShowAuthModal(false);
    }
  }, [isSignedIn]);

  return (
    <>
      <Link
        href="/debates/new"
        className={className}
        onClick={(event) => {
          if (!isLoaded) return;
          if (!isSignedIn && hasAnonymousTrialUsed()) {
            event.preventDefault();
            setShowAuthModal(true);
          }
        }}
      >
        {children}
      </Link>
      <RequireAuthModal open={showAuthModal} mandatory />
    </>
  );
}
