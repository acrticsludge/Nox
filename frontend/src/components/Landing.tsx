import type { ReactNode } from 'react'
import { Section } from '@astryxdesign/core/Section'
import { Card } from '@astryxdesign/core/Card'
import { Button } from '@astryxdesign/core/Button'
import { Badge } from '@astryxdesign/core/Badge'
import { Link } from '@astryxdesign/core/Link'
import { Heading, Text } from '@astryxdesign/core/Text'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Grid } from '@astryxdesign/core/Grid'

function DiamondMark() {
  return (
    <span className="diamond-mark" aria-hidden="true">
      <span />
    </span>
  )
}

function Keycap({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return <span className={`keycap${accent ? ' keycap-accent' : ''}`}>{children}</span>
}

function Orb({ type }: { type: 'dash' | 'shield' | 'gravity' | 'split' }) {
  return (
    <span className={`orb orb-${type}`} aria-hidden="true">
      {type === 'dash' && '»'}
      {type === 'shield' && '◇'}
      {type === 'gravity' && '↓'}
      {type === 'split' && '✦'}
    </span>
  )
}

const instructions: {
  number: string
  title: string
  accent: 'cyan' | 'pink' | 'orange'
  children: ReactNode
}[] = [
  {
    number: '01',
    title: 'Move & Dash',
    accent: 'cyan',
    children: (
      <div className="instruction-content">
        <div className="player-row">
          <span className="player-label">P1</span>
          <div className="key-group">
            <Keycap>W</Keycap>
            <Keycap>A</Keycap>
            <Keycap>S</Keycap>
            <Keycap>D</Keycap>
          </div>
          <Keycap accent>SHIFT</Keycap>
        </div>
        <div className="player-row">
          <span className="player-label">P2</span>
          <div className="key-group">
            <Keycap>↑</Keycap>
            <Keycap>←</Keycap>
            <Keycap>↓</Keycap>
            <Keycap>→</Keycap>
          </div>
          <Keycap accent>ENTER</Keycap>
        </div>
      </div>
    ),
  },
  {
    number: '02',
    title: 'Grab Orbs',
    accent: 'pink',
    children: (
      <div className="instruction-content orb-content">
        <div className="orb-row">
          <Orb type="dash" />
          <Orb type="shield" />
          <Orb type="gravity" />
          <Orb type="split" />
        </div>
        <Text type="body" color="secondary">
          Power up. Break the rules.
          <br />
          <strong>Every orb changes the game.</strong>
        </Text>
      </div>
    ),
  },
  {
    number: '03',
    title: 'Survive',
    accent: 'orange',
    children: (
      <div className="instruction-content survival-content">
        <div className="hazard-line">
          <span className="hazard-icon">∿</span>
          <span>LAVA / SLIME / VOID</span>
        </div>
        <Text type="body" color="secondary">
          Last player standing wins.
          <br />
          <strong>Survive 45 seconds.</strong>
        </Text>
      </div>
    ),
  },
]

export default function Landing() {
  const goToGame = () => {
    window.location.href = '/play'
  }

  return (
    <main className="nox-shell">
      <div className="grid-noise" aria-hidden="true" />

      <header className="nox-header">
        <HStack gap={3} vAlign="center">
          <DiamondMark />
          <Link href="#top" className="brand-lockup">
            NOX
          </Link>
        </HStack>
        <Badge
          variant="cyan"
          icon={<span className="status-dot" aria-hidden="true" />}
          label="NEON VOID // ONLINE"
        />
      </header>

      <Section
        variant="transparent"
        padding={0}
        minHeight={590}
        className="nox-content hero-section"
        aria-labelledby="hero-title"
      >
        <p className="eyebrow">
          <span className="eyebrow-line" /> TWO PLAYERS. ONE VOID.
        </p>
        <h1 className="hero-title" id="hero-title">
          NEON
          <br />
          <em>VOID</em>
        </h1>
        <p className="hero-copy">
          A chaotic local multiplayer arena where the floor is lava
          <br className="desktop-break" /> and the last one standing wins.
        </p>
        <Button label="PLAY NOW ↗" variant="primary" size="lg" onClick={goToGame} />
        <div className="hero-decoration" aria-hidden="true">
          <span className="crosshair">+</span>
          <span className="coordinates">
            34° 12&apos; 08&quot; N
            <br />
            118° 14&apos; 37&quot; W
          </span>
        </div>
      </Section>

      <Section
        variant="transparent"
        padding={0}
        dividers={['top']}
        className="nox-content"
        id="how-to-play"
        aria-labelledby="how-title"
      >
        <div className="section-heading">
          <span className="section-kicker">THE BASICS</span>
          <h2 className="section-title" id="how-title">
            HOW TO
            <br />
            <span>PLAY</span>
          </h2>
        </div>
        <Grid columns={{ minWidth: 260, repeat: 'fit' }} gap={3} width="100%">
          {instructions.map((item) => (
            <Card
              key={item.number}
              variant={item.accent}
              padding={5}
              minHeight={280}
              className={`instruction-card card-accent-${item.accent}`}
            >
              <VStack gap={4}>
                <HStack gap={3} vAlign="center">
                  <span className="card-number">{item.number}</span>
                  <span className="card-rule" />
                </HStack>
                <Heading level={3}>{item.title}</Heading>
                {item.children}
              </VStack>
            </Card>
          ))}
        </Grid>
      </Section>

      <footer className="nox-footer">
        <Text type="supporting" color="secondary">
          © NOX / NEON VOID
        </Text>
        <Text type="supporting" color="secondary">
          BUILT FOR THE VOID
        </Text>
      </footer>
    </main>
  )
}
