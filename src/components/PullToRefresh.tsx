"use client";

import React, { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
    onRefresh: () => Promise<void> | void;
    children: React.ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
    const [startY, setStartY] = useState(0);
    const [currentY, setCurrentY] = useState(0);
    const [isPulling, setIsPulling] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const PULL_THRESHOLD = 80;
    const MAX_PULL = 120;

    const handleTouchStart = (e: React.TouchEvent) => {
        // Only trigger pull-to-refresh if we are at the top of the page
        if (window.scrollY <= 10) {
            setStartY(e.touches[0].clientY);
            setIsPulling(true);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isPulling) return;

        const y = e.touches[0].clientY;
        const deltaY = y - startY;

        // Only handle pulling down
        if (deltaY > 0 && window.scrollY <= 10) {
            // Add resistance
            const pullDistance = Math.min(deltaY * 0.45, MAX_PULL);
            setCurrentY(pullDistance);

            // Note: preventDefault() strictly inside touchMove doesn't always work in React
            // thus we use the native event listener in the useEffect below.
        } else {
            setIsPulling(false);
            setCurrentY(0);
        }
    };

    const handleTouchEnd = async () => {
        if (!isPulling) return;

        if (currentY >= PULL_THRESHOLD) {
            setIsRefreshing(true);
            setCurrentY(PULL_THRESHOLD * 0.7); // Snap to threshold while refreshing
            try {
                await onRefresh();
            } finally {
                setIsRefreshing(false);
                setCurrentY(0);
                setIsPulling(false);
            }
        } else {
            setCurrentY(0);
            setIsPulling(false);
        }
    };

    const pullPercentage = Math.min(currentY / PULL_THRESHOLD, 1);

    // To properly prevent default in React 18+ for touch events (which are passive by default)
    // we need a native event listener with passive: false
    useEffect(() => {
        const preventScroll = (e: TouchEvent) => {
            if (isPulling && e.touches[0].clientY > startY && window.scrollY <= 10) {
                if (e.cancelable) e.preventDefault();
            }
        };

        const container = containerRef.current;
        if (container) {
            container.addEventListener('touchmove', preventScroll, { passive: false });
        }

        return () => {
            if (container) {
                container.removeEventListener('touchmove', preventScroll);
            }
        };
    }, [isPulling, startY]);

    return (
        <div
            ref={containerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ minHeight: '100%', position: 'relative' }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: `${PULL_THRESHOLD}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    transform: `translateY(${currentY - PULL_THRESHOLD}px)`,
                    transition: isPulling ? 'none' : 'transform 0.3s ease-out',
                    zIndex: 10,
                }}
            >
                <div
                    style={{
                        transform: `rotate(${pullPercentage * 360}deg)`,
                        opacity: isRefreshing ? 1 : Math.max(0, pullPercentage - 0.2), // starts appearing at 20%
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--card)',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        boxShadow: 'var(--shadow-md)',
                        marginTop: '0.5rem',
                        border: '1px solid var(--border)'
                    }}
                >
                    <Loader2 size={24} className={isRefreshing ? "animate-spin" : ""} />
                </div>
            </div>
            <div style={{
                transform: `translateY(${currentY}px)`,
                transition: isPulling ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}>
                {children}
            </div>
        </div>
    );
}
