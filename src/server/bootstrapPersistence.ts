import {
  ADMIN_ACCOUNTS,
  AUDIT_LOGS,
  STUDENT_ACCOUNTS
} from './authStore.ts';
import {
  DEPARTMENTS_STORE,
  DOMAINS_STORE,
  FACULTIES_STORE,
  HALLS_STORE
} from './domainStore.ts';
import {
  CANDIDATES_STORE,
  ELECTIONS_STORE,
  POSITIONS_STORE,
  recomputeAllElectionCounts
} from './electionStore.ts';
import { NOTIFICATIONS_STORE } from './notificationStore.ts';
import { BALLOT_LEDGER_STORE } from './resultsStore.ts';
import { registerStatePersistence } from './statePersistence.ts';
import {
  ANONYMOUS_BALLOT_VAULT,
  VOTER_PARTICIPATION_VAULT
} from './votingStore.ts';

function dumpMapEntries<K, V>(map: Map<K, V>): Array<[K, V]> {
  return Array.from(map.entries());
}

function hydrateMapInPlace<K, V>(map: Map<K, V>, entries: unknown) {
  if (!Array.isArray(entries)) return;
  map.clear();
  for (const item of entries) {
    if (Array.isArray(item) && item.length === 2) {
      map.set(item[0] as K, item[1] as V);
    }
  }
}

function hydrateArrayInPlace<T>(target: T[], nextItems: unknown) {
  if (!Array.isArray(nextItems)) return;
  target.splice(0, target.length, ...(nextItems as T[]));
}

registerStatePersistence(
  () => ({
    version: 1,
    savedAt: new Date().toISOString(),
    elections: dumpMapEntries(ELECTIONS_STORE),
    positions: dumpMapEntries(POSITIONS_STORE),
    candidates: dumpMapEntries(CANDIDATES_STORE),
    ballotLedgers: dumpMapEntries(BALLOT_LEDGER_STORE),
    domains: dumpMapEntries(DOMAINS_STORE),
    halls: HALLS_STORE,
    faculties: FACULTIES_STORE,
    departments: DEPARTMENTS_STORE,
    voterParticipation: dumpMapEntries(VOTER_PARTICIPATION_VAULT),
    anonymousBallots: ANONYMOUS_BALLOT_VAULT,
    notifications: NOTIFICATIONS_STORE,
    studentAccounts: dumpMapEntries(STUDENT_ACCOUNTS),
    adminAccounts: dumpMapEntries(ADMIN_ACCOUNTS),
    auditLogs: AUDIT_LOGS
  }),
  (snapshot) => {
    hydrateMapInPlace(ELECTIONS_STORE, snapshot.elections);
    hydrateMapInPlace(POSITIONS_STORE, snapshot.positions);
    hydrateMapInPlace(CANDIDATES_STORE, snapshot.candidates);
    hydrateMapInPlace(BALLOT_LEDGER_STORE, snapshot.ballotLedgers);
    hydrateMapInPlace(DOMAINS_STORE, snapshot.domains);
    hydrateArrayInPlace(HALLS_STORE, snapshot.halls);
    hydrateArrayInPlace(FACULTIES_STORE, snapshot.faculties);
    hydrateArrayInPlace(DEPARTMENTS_STORE, snapshot.departments);
    hydrateMapInPlace(VOTER_PARTICIPATION_VAULT, snapshot.voterParticipation);
    hydrateArrayInPlace(ANONYMOUS_BALLOT_VAULT, snapshot.anonymousBallots);
    hydrateArrayInPlace(NOTIFICATIONS_STORE, snapshot.notifications);
    hydrateMapInPlace(STUDENT_ACCOUNTS, snapshot.studentAccounts);
    hydrateMapInPlace(ADMIN_ACCOUNTS, snapshot.adminAccounts);
    hydrateArrayInPlace(AUDIT_LOGS, snapshot.auditLogs);

    const ballotsByElection = new Map<string, number>();
    for (const ballot of ANONYMOUS_BALLOT_VAULT) {
      ballotsByElection.set(ballot.electionId, (ballotsByElection.get(ballot.electionId) || 0) + 1);
    }
    recomputeAllElectionCounts(ballotsByElection);
  }
);
