"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
    Captions,
    CaptionButton,
    Controls,
    FullscreenButton,
    Gesture,
    MuteButton,
    PIPButton,
    PlayButton,
    SeekButton,
    Time,
    TimeSlider,
    VolumeSlider,
    isTrackCaptionKind,
    useCaptionOptions,
    useMediaState,
    usePlaybackRateOptions,
    type CaptionOption,
    type PlaybackRateOption,
} from '@vidstack/react';
import { cn } from '@/lib/utils';
import {
    CaptionsOffIcon,
    CaptionsOnIcon,
    CheckIcon,
    FullscreenEnterIcon,
    FullscreenExitIcon,
    PauseIcon,
    PipEnterIcon,
    PipExitIcon,
    PlayIcon,
    ReplayIcon,
    SeekBackIcon,
    SeekForwardIcon,
    SettingsIcon,
    VolumeHighIcon,
    VolumeLowIcon,
    VolumeMuteIcon,
} from './icons';
import styles from './controls.module.css';

function CenterStage() {
    const paused = useMediaState('paused');
    const waiting = useMediaState('waiting');
    const ended = useMediaState('ended');

    return (
        <div className={styles.center} aria-hidden={!paused && !waiting}>
            {waiting ? (
                <div className={styles.spinner} role="status" aria-label="Buforowanie" />
            ) : paused ? (
                <PlayButton className={styles.hero} aria-label={ended ? 'Odtwórz ponownie' : 'Odtwórz'}>
                    <span className={styles.heroGlow} />
                    {ended ? (
                        <ReplayIcon className={styles.heroIcon} />
                    ) : (
                        <PlayIcon className={cn(styles.heroIcon, styles.heroPlayIcon)} />
                    )}
                </PlayButton>
            ) : null}
        </div>
    );
}

function PlayPauseButton() {
    const paused = useMediaState('paused');

    return (
        <PlayButton
            className={cn(styles.button, styles.playButton)}
            aria-label={paused ? 'Odtwórz' : 'Pauza'}
        >
            {paused ? <PlayIcon className={styles.icon} /> : <PauseIcon className={styles.icon} />}
        </PlayButton>
    );
}

function VolumeControl() {
    const muted = useMediaState('muted');
    const volume = useMediaState('volume');
    const canSetVolume = useMediaState('canSetVolume');
    const isMuted = muted || volume === 0;

    return (
        <div className={styles.volume}>
            <MuteButton className={styles.button} aria-label={isMuted ? 'Włącz dźwięk' : 'Wycisz'}>
                {isMuted ? (
                    <VolumeMuteIcon className={styles.icon} />
                ) : volume < 0.5 ? (
                    <VolumeLowIcon className={styles.icon} />
                ) : (
                    <VolumeHighIcon className={styles.icon} />
                )}
            </MuteButton>
            {canSetVolume && (
                <VolumeSlider.Root className={styles.volumeSlider} aria-label="Głośność">
                    <VolumeSlider.Track className={styles.volumeTrack}>
                        <VolumeSlider.TrackFill className={styles.volumeFill} />
                    </VolumeSlider.Track>
                    <VolumeSlider.Thumb className={styles.volumeThumb} />
                </VolumeSlider.Root>
            )}
        </div>
    );
}

function TimeDisplay() {
    return (
        <div className={styles.time}>
            <Time type="current" />
            <span className={styles.timeSeparator}>/</span>
            <Time type="duration" className={styles.duration} />
        </div>
    );
}

function ScrubBar() {
    return (
        <TimeSlider.Root className={styles.scrub} aria-label="Postęp odtwarzania">
            <TimeSlider.Track className={styles.scrubTrack}>
                <TimeSlider.Progress className={styles.scrubBuffer} />
                <TimeSlider.TrackFill className={styles.scrubFill} />
            </TimeSlider.Track>
            <TimeSlider.Thumb className={styles.scrubThumb} />
            <TimeSlider.Preview className={styles.scrubPreview}>
                <TimeSlider.Value className={styles.scrubPreviewValue} />
            </TimeSlider.Preview>
        </TimeSlider.Root>
    );
}

function SpeedMenuSection({ onSelect }: { onSelect: () => void }) {
    const options = usePlaybackRateOptions({ normalLabel: 'Normalna' });
    if (options.disabled) return null;

    return (
        <div className={styles.menuSection}>
            <div className={styles.menuHeading}>Prędkość</div>
            {options.map((option: PlaybackRateOption) => (
                <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={option.selected}
                    className={cn(styles.menuItem, option.selected && styles.menuItemSelected)}
                    onClick={() => {
                        option.select();
                        onSelect();
                    }}
                >
                    <span>{option.label}</span>
                    {option.selected && <CheckIcon className={styles.menuCheck} />}
                </button>
            ))}
        </div>
    );
}

function CaptionsMenuSection({ onSelect }: { onSelect: () => void }) {
    const options = useCaptionOptions({ off: 'Wyłączone' });
    if (options.length === 0) return null;

    return (
        <div className={styles.menuSection}>
            <div className={styles.menuHeading}>Napisy</div>
            {options.map((option: CaptionOption) => (
                <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={option.selected}
                    className={cn(styles.menuItem, option.selected && styles.menuItemSelected)}
                    onClick={() => {
                        option.select();
                        onSelect();
                    }}
                >
                    <span>{option.label}</span>
                    {option.selected && <CheckIcon className={styles.menuCheck} />}
                </button>
            ))}
        </div>
    );
}

function SettingsMenu() {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        function onPointerDown(event: PointerEvent) {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') setOpen(false);
        }

        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    const close = () => setOpen(false);

    return (
        <div className={styles.menuRoot} ref={rootRef}>
            <button
                type="button"
                className={cn(styles.button, open && styles.settingsOpen)}
                aria-label="Ustawienia"
                aria-expanded={open}
                aria-haspopup="menu"
                onClick={() => setOpen((value) => !value)}
            >
                <SettingsIcon className={styles.icon} />
            </button>
            {open && (
                <div className={styles.menu} role="menu" aria-label="Ustawienia odtwarzacza">
                    <SpeedMenuSection onSelect={close} />
                    <CaptionsMenuSection onSelect={close} />
                </div>
            )}
        </div>
    );
}

function CaptionToggle() {
    const hasCaptions = useMediaState('hasCaptions');
    const track = useMediaState('textTrack');
    const isOn = Boolean(track && isTrackCaptionKind(track));
    if (!hasCaptions) return null;

    return (
        <CaptionButton
            className={cn(styles.button, styles.captionButton)}
            aria-label={isOn ? 'Wyłącz napisy' : 'Włącz napisy'}
        >
            {isOn ? <CaptionsOnIcon className={styles.icon} /> : <CaptionsOffIcon className={styles.icon} />}
        </CaptionButton>
    );
}

function PipToggleButton() {
    const canPip = useMediaState('canPictureInPicture');
    const isPip = useMediaState('pictureInPicture');
    if (!canPip) return null;

    return (
        <PIPButton
            className={cn(styles.button, styles.pipButton)}
            aria-label={isPip ? 'Wyłącz obraz w obrazie' : 'Obraz w obrazie'}
        >
            {isPip ? <PipExitIcon className={styles.icon} /> : <PipEnterIcon className={styles.icon} />}
        </PIPButton>
    );
}

function FullscreenToggleButton() {
    const canFullscreen = useMediaState('canFullscreen');
    const isFullscreen = useMediaState('fullscreen');
    if (!canFullscreen) return null;

    return (
        <FullscreenButton
            className={styles.button}
            aria-label={isFullscreen ? 'Zamknij pełny ekran' : 'Pełny ekran'}
        >
            {isFullscreen ? (
                <FullscreenExitIcon className={styles.icon} />
            ) : (
                <FullscreenEnterIcon className={styles.icon} />
            )}
        </FullscreenButton>
    );
}

interface PolutekControlsProps {
    className?: string;
}

export default function PolutekControls({ className }: PolutekControlsProps) {
    const controlsVisible = useMediaState('controlsVisible');

    return (
        <>
            <Gesture className={styles.gesture} event="pointerup" action="toggle:paused" />
            <Gesture className={styles.gesture} event="dblpointerup" action="toggle:fullscreen" />
            <Captions className={cn('vds-captions', styles.captions)} />
            <CenterStage />
            <Controls.Root
                className={cn(styles.controls, controlsVisible && styles.controlsVisible, className)}
            >
                <div className={styles.scrim} />
                <Controls.Group className={styles.bottom}>
                    <ScrubBar />
                    <div className={styles.row}>
                        <div className={styles.rowGroup}>
                            <PlayPauseButton />
                            <SeekButton
                                seconds={-10}
                                className={cn(styles.button, styles.seekButton)}
                                aria-label="Cofnij 10 sekund"
                            >
                                <SeekBackIcon className={styles.icon} />
                            </SeekButton>
                            <SeekButton
                                seconds={10}
                                className={cn(styles.button, styles.seekButton)}
                                aria-label="Przewiń 10 sekund"
                            >
                                <SeekForwardIcon className={styles.icon} />
                            </SeekButton>
                            <VolumeControl />
                            <TimeDisplay />
                        </div>
                        <div className={styles.rowGroup}>
                            <CaptionToggle />
                            <SettingsMenu />
                            <PipToggleButton />
                            <FullscreenToggleButton />
                        </div>
                    </div>
                </Controls.Group>
            </Controls.Root>
        </>
    );
}
