
import { Account } from './account';
import { Message } from './message';

import { BehaviorSubject } from 'rxjs/BehaviorSubject';

import { nonenumerable } from 'nonenumerable';
import { find, reject, pullAt, extend } from 'lodash';

export class LobbyState {
  accounts: Account[] = [];
  messages: Message[] = [];
  motd: string;

  @nonenumerable
  account$ = new BehaviorSubject<Account[]>([]);

  @nonenumerable
  inGame = {};

  @nonenumerable
  status = {};

  constructor({ accounts = [], messages = [], motd = '' }) {
    this.accounts = accounts;
    this.messages = messages;
    this.motd = motd;
  }

  syncTo(state: LobbyState) {
    const oldAccLength = this.accounts.length;
    extend(this, state);

    if(this.accounts.length !== oldAccLength) {
      this.account$.next(this.accounts);
    }

    this.accounts.forEach(account => {
      this.inGame[account.username] = account.inGame;
      this.status[account.username] = account.status;
    });
  }

  addMessage(message: Message) {
    if(!message.timestamp) message.timestamp = Date.now();

    this.messages.push(message);

    if(this.messages.length > 500) {
      this.messages.shift();
    }
  }

  findAccount(userId: string) {
    return find(this.accounts, { userId });
  }

  addAccount(account: Account) {
    this.accounts.push(account);
    this.account$.next(this.accounts);
  }

  removeAccount(username: string) {
    this.accounts = reject(this.accounts, account => account.username === username);
    this.account$.next(this.accounts);
  }

  removeAccountAtPosition(position: number) {
    pullAt(this.accounts, [position]);
    this.account$.next(this.accounts);
  }
}
