import { Injectable } from '@angular/core';

import { Observable, BehaviorSubject } from 'rxjs';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/map';
import 'rxjs/add/observable/throw';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/switchMap';

import { WorkerService, BackendService } from '../core';
import { Logger, Pagination } from '../shared';
import { User } from './user.model';

@Injectable()
export class UserService {
    private basePath: string = 'Users';

    items: BehaviorSubject<Array<User>> = new BehaviorSubject([]);

    private _allItems: Array<User> = [];

    constructor(private backendService: BackendService, private worker: WorkerService) {
    }

    load(pagination?: Pagination) {
        if (Logger.isEnabled) {
            Logger.log('loading users...');
        }
        this._allItems.length = 0;

        return this.backendService.load(this.basePath, pagination)
            .then(response => {
                if (Logger.isEnabled) {
                    Logger.log('response = ');
                    Logger.dir(response);
                }

                var data;
                if (response instanceof Response || typeof response.json !== 'undefined') {
                    data = response.json();
                } else if (response instanceof Array) {
                    data = response;
                } else {
                    throw Error('The loaded result does not match any expected format.');
                }

                data.forEach((rawEntry) => {
                    let newEntry = this.newModel(rawEntry);

                    this._allItems.push(newEntry);
                });

                this.publishUpdates();
            });
    }

    get(id: string) {
        if (Logger.isEnabled) {
            Logger.log('retrieving a user = ' + id);
        }

        return this.backendService
            .getById(this.basePath, id)
            .then(response => {
                if (Logger.isEnabled) {
                    Logger.log('response = ');
                    Logger.dir(response);
                }

                var data;
                if (response instanceof Response || typeof response.json !== 'undefined') {
                    data = response.json();
                } else if (response instanceof Object) {
                    data = response;
                } else {
                    throw Error('The loaded result does not match any expected format.');
                }

                return data;
            });
    }

    get count(): number {
        return this._allItems.length;
    }

    add(user: User) {
        let body = JSON.stringify({
            username: user.username,
            email: user.email,
            password: user.password,
            owner: this.backendService.userId
        });

        if (Logger.isEnabled) {
            Logger.log('registering in user = ' + body);
        }

        return this.backendService.push(
            this.basePath, body
        );
    }

    update(user: User) {
        if (Logger.isEnabled) {
            Logger.log('updating a user = ' + user);
        }

        return this.backendService.set(
            this.basePath, user.id, user
        )
            .then(res => res.json())
            .then(data => {
                this.publishUpdates();
            });
    }

    delete(user: User) {
        if (Logger.isEnabled) {
            Logger.log('deleting a user = ' + user);
        }

        return this.backendService
            .remove(
            this.basePath, user.id
            )
            .then(res => res.json())
            .then(data => {
                user.deleted = true;
                user.deleting = false;
                let index = this._allItems.indexOf(user);
                this._allItems.splice(index, 1);
                this.publishUpdates();
            });
    }

    public newModel(data?: any): User {
        return new User(
            data.email,
            undefined,
            data.username,
            data.verified || false,
            data.active || false,
            data.role || null,
            data.createdAt ? new Date(data.createdAt) : null,
            data.modifiedAt ? new Date(data.modifiedAt) : null,
            data.createdBy || null,
            data.modifiedBy || null,
            data.owner || null,
            data.id || null
        );
    }

    private publishUpdates() {
        // Make sure all updates are published inside NgZone so that change detection is triggered if needed
        this.worker.run(() => {
            // must emit a *new* value (immutability!)
            this.items.next([...this._allItems]);
        });
    }
}
