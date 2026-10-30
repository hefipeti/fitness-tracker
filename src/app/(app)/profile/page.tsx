import { requireUser } from '@/lib/auth';
import { Bar, PageHead, Panel, RankBadge, fmtNum } from '@/components/ui';
import { RunForm } from '@/components/system';
import { SearchableSelect } from '@/components/searchable-select';
import { getHunterFull, listAchievements, listWeights, listXpEvents } from '@/lib/queries';
import { getSettings } from '@/lib/settings';
import { RANKS, STAT_INFO, type Stats } from '@/lib/game';
import { formatShort } from '@/lib/dates';
import { updateSettingsAction, updateLocaleAction } from '@/lib/actions/profile';
import { deleteWeightAction } from '@/lib/actions/food';
import { changePasswordAction, createAccountAction, resetPasswordAction } from '@/lib/actions/profile';
import { logoutAction } from '@/lib/actions/auth';
import { listUsers } from '@/lib/users';
import { PLAN_TEMPLATES } from '@/lib/templates';
import { getTranslations } from 'next-intl/server';

export const metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const user = await requireUser();
  const uid = user.id;
  const [hunter, settings, achievements, events, weights, users, t] = await Promise.all([
    getHunterFull(uid),
    getSettings(uid),
    listAchievements(uid),
    listXpEvents(uid, 25),
    listWeights(uid, 10),
    user.isAdmin ? listUsers() : Promise.resolve([]),
    getTranslations(),
  ]);
  const statKeys = Object.keys(STAT_INFO) as (keyof Stats)[];
  const unlocked = achievements.filter((a) => a.unlockedAt).length;

  return (
    <>
      <PageHead kicker={t('profile.kicker')} title={t('profile.title')}>
        <div className="row">
          <span className="mono muted small">@{user.username}{user.isAdmin ? t('profile.adminBadge') : ''}</span>
          <form action={logoutAction}>
            <button className="btn sm">{t('profile.signOut')}</button>
          </form>
        </div>
      </PageHead>

      <div className="grid c2">
        <Panel title={t('profile.rankStats')} className="glow">
          <div className="row" style={{ gap: 16 }}>
            <RankBadge letter={hunter.rank.letter} size="lg" />
            <div className="grow">
              <div className="small muted" style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                {hunter.rank.title}
              </div>
              <div className="big-level">LV {hunter.level}</div>
              <div className="tiny mono muted">{fmtNum(hunter.totalXp)} XP total</div>
            </div>
          </div>
          <div className="col mt" style={{ gap: 12 }}>
            {statKeys.map((k) => (
              <div key={k}>
                <div className="stat-row">
                  <span className="k">{k}</span>
                  <Bar value={hunter.stats[k]} max={Math.max(20, ...statKeys.map((x) => hunter.stats[x])) * 1.15} className="thin" />
                  <span className="v">{hunter.stats[k]}</span>
                </div>
                <div className="tiny dim" style={{ paddingLeft: 62 }}>
                  {STAT_INFO[k].name} · {STAT_INFO[k].formula}
                </div>
              </div>
            ))}
          </div>
          <div className="tiny dim mt">
            {t('profile.ranks', { ranks: RANKS.map((r) => `${r.letter} from level ${r.minLevel}`).join(' · ') })}
          </div>
        </Panel>

        <Panel title={t('profile.settings')}>
          <form action={updateSettingsAction} className="col">
            <label className="field">
              {t('profile.hunterName')}
              <input name="hunterName" defaultValue={settings.hunterName} required maxLength={40} />
            </label>
            <div className="form-row">
              <label className="field">
                {t('profile.kcal')}
                <input name="kcalTarget" type="number" min="500" max="10000" defaultValue={settings.kcalTarget} />
              </label>
              <label className="field">
                {t('profile.protein')}
                <input name="proteinTarget" type="number" min="0" max="600" defaultValue={settings.proteinTarget} />
              </label>
            </div>
            <div className="form-row">
              <label className="field">
                {t('profile.carbs')}
                <input name="carbsTarget" type="number" min="0" max="1500" defaultValue={settings.carbsTarget} />
              </label>
              <label className="field">
                {t('profile.fat')}
                <input name="fatTarget" type="number" min="0" max="500" defaultValue={settings.fatTarget} />
              </label>
            </div>
            <div className="form-row">
              <label className="field">
                {t('profile.startWeight')}
                <input name="startWeight" type="number" step="0.1" defaultValue={settings.startWeight ?? ''} />
              </label>
              <label className="field">
                {t('profile.goalWeight')}
                <input name="goalWeight" type="number" step="0.1" defaultValue={settings.goalWeight ?? ''} />
              </label>
              <label className="field">
                {t('profile.height')}
                <input name="heightCm" type="number" defaultValue={settings.heightCm ?? ''} />
              </label>
            </div>
            <div>
              <button className="btn primary">{t('profile.saveSettings')}</button>
            </div>
          </form>
          <div className="mt-s">
            <form action={updateLocaleAction} className="form-row">
              <label className="field">
                {t('profile.language')}
                <select name="locale" defaultValue={settings.locale}>
                  <option value="en">{t('profile.langEn')}</option>
                  <option value="hu">{t('profile.langHu')}</option>
                </select>
              </label>
              <button className="btn" style={{ alignSelf: 'flex-end' }}>{t('profile.saveSettings')}</button>
            </form>
          </div>
        </Panel>
      </div>

      <Panel title={t('profile.achievements', { unlocked, total: achievements.length })} className="mt">
        <div className="grid c3">
          {achievements.map((a) => (
            <div key={a.key} className={`ach ${a.unlockedAt ? 'on' : ''}`}>
              <div className="ic">{a.unlockedAt ? '★' : '🔒︎'}</div>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{a.name}</div>
                <div className="small muted">{a.desc}</div>
                <div className="tiny mono" style={{ color: 'var(--violet-2)', marginTop: 2 }}>
                  {a.unlockedAt ? t('profile.unlocked', { date: formatShort(a.unlockedAt.slice(0, 10)) }) : `+${a.xp} XP`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid c2 mt">
        <Panel title={t('profile.recentWeighIns')}>
          {weights.length === 0 ? (
            <div className="empty">{t('profile.noWeighIns')}</div>
          ) : (
            <div className="list">
              {weights.map((w) => (
                <div className="item" key={w.date} style={{ padding: '7px 0' }}>
                  <div className="grow mono small">{formatShort(w.date)}</div>
                  <span className="mono">{w.kg} kg</span>
                  <form action={deleteWeightAction}>
                    <input type="hidden" name="date" value={w.date} />
                    <button className="btn sm ghost icon" aria-label={`Delete weigh-in ${w.date}`}>
                      ✕
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={t('profile.xpHistory')}>
          {events.length === 0 ? (
            <div className="empty">{t('profile.noXp')}</div>
          ) : (
            <div className="list">
              {events.map((e) => (
                <div className="item" key={e.id} style={{ padding: '7px 0' }}>
                  <div className="grow small">
                    {e.label}
                    <span className="dim"> · {formatShort(e.eventDate)}</span>
                  </div>
                  <span className="mono" style={{ color: e.xp >= 0 ? 'var(--violet-3)' : 'var(--danger)' }}>
                    {e.xp >= 0 ? '+' : ''}
                    {e.xp}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid c2 mt">
        <Panel title={t('profile.changePassword')}>
          <RunForm action={changePasswordAction} className="col">
            <label className="field">
              {t('profile.currentPassword')}
              <input name="current" type="password" autoComplete="current-password" required />
            </label>
            <label className="field">
              {t('profile.newPassword')}
              <input name="next" type="password" autoComplete="new-password" required minLength={8} />
            </label>
            <label className="field">
              {t('profile.repeatPassword')}
              <input name="confirm" type="password" autoComplete="new-password" required minLength={8} />
            </label>
            <div>
              <button className="btn">{t('profile.changePasswordBtn')}</button>
            </div>
          </RunForm>
        </Panel>

        {user.isAdmin && (
          <Panel title={t('profile.accounts')}>
            <div className="list">
              {users.map((u) => (
                <div className="item" key={u.id} style={{ alignItems: 'flex-start' }}>
                  <details className="fold grow">
                    <summary style={{ display: 'inline' }}>
                      <span className="t">{u.hunterName ?? u.username}</span>
                      <span className="s mono muted">
                        {' '}
                        · @{u.username}
                        {u.isAdmin ? ' · admin' : ''}
                      </span>
                    </summary>
                    <RunForm action={resetPasswordAction} className="form-row">
                      <input type="hidden" name="userId" value={u.id} />
                      <label className="field">
                        {t('auth.newPassword')}
                        <input name="password" type="password" autoComplete="new-password" required minLength={8} />
                      </label>
                      <button className="btn sm">Reset password</button>
                    </RunForm>
                  </details>
                </div>
              ))}
            </div>
            <details className="fold mt">
              <summary>{t('profile.addAccount')}</summary>
              <RunForm action={createAccountAction} className="col">
                <label className="field">
                  {t('profile.username')}
                  <input name="username" required minLength={3} maxLength={32} autoCapitalize="none" />
                </label>
                <label className="field">
                  {t('profile.displayName')}
                  <input name="hunterName" maxLength={40} />
                </label>
                <label className="field">
                  {t('profile.tempPassword')}
                  <input name="password" type="password" autoComplete="new-password" required minLength={8} />
                </label>
                <label className="field">
                  {t('profile.startingPlan')}
                  <SearchableSelect
                    name="template"
                    defaultValue="starter"
                    options={[
                      ...PLAN_TEMPLATES.map((tmpl) => ({ value: tmpl.key, label: tmpl.name })),
                      { value: 'none', label: t('profile.noPlan') },
                    ]}
                  />
                </label>
                <div>
                  <button className="btn primary">{t('profile.createAccount')}</button>
                </div>
              </RunForm>
              <p className="tiny dim mt-s">
                {t('profile.accountNote')}
              </p>
            </details>
          </Panel>
        )}
      </div>
    </>
  );
}
