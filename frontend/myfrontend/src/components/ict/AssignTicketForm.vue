<script>
import { Const } from '@/utils/constants'
import axios from 'axios'
import Toastify from 'toastify-js'

export default {
  props: {
    ticket: { type: Object, required: true },
    mode: { type: String, default: 'assign' }
  },

  data() {
    return {
      users: [],
      teams: ['JSC', 'eboard', 'tonerSupport', 'networkSupport', 'softwareSupport'],
      formData: {
        ticketID: '',
        ticketNumber: '',
        assignedTo: '',
        priority: '',
        reason: '',
        escalatedToTeam: '',
        resolutionDetails: '',
        note: '',
        attachments: null
      },
      loadingUsers: false,
      loading: false
    }
  },

  watch: {
    ticket: {
      immediate: true,
      handler(newVal) {
        if (newVal) {
          this.formData = {
            ticketID: newVal.ticketID || '',
            ticketNumber: newVal.ticketNumber || '',
            assignedTo: newVal.assignedTo || '',
            priority: newVal.priority || '',
            reason: '',
            escalatedToTeam: '',
            resolutionDetails: '',
            note: '',
            attachments: null
          }
        }
      }
    }
  },

  mounted() {
    this.fetchUsers()
  },

  methods: {
    showToast(message, isDanger = false) {
      Toastify({
        text: message,
        style: { background: isDanger ? '#d63939' : '#2fb344' }
      }).showToast()
    },

    async fetchUsers() {
      try {
        this.loadingUsers = true
        const res = await axios.get(`${Const.BASE_URL}/users/list`, {
          params: { role: 'agent' },
          headers: { 'access-token': localStorage.getItem('accessToken') }
        })

        const userList = res.data?.data || []
        this.users = userList.filter(user => user.status === 'active')
      } catch (error) {
        console.error('Failed to load users:', error)
        this.showToast(error.response?.data?.message || 'Failed to load users', true)
      } finally {
        this.loadingUsers = false
      }
    },

    async handleSubmit() {
      try {
        this.loading = true

        let url = ''
        let payload = {
          ticketID: this.formData.ticketID
        }

        switch (this.mode) {
          case 'assign':
            if (!this.formData.assignedTo || !this.formData.priority) {
              return this.showToast('Assign user and priority required', true)
            }
            payload.assignedTo = this.formData.assignedTo
            payload.priority = this.formData.priority
            url = `${Const.BASE_URL}/helpDesk/assign`
            break

          case 'reassign':
            if (!this.formData.assignedTo || !this.formData.reason) {
              return this.showToast('User and reason required', true)
            }
            payload.assignedTo = this.formData.assignedTo
            payload.reason = this.formData.reason
            url = `${Const.BASE_URL}/helpDesk/reassignTicket`
            break

          case 'escalate':
            if (!this.formData.assignedTo || !this.formData.escalatedToTeam || !this.formData.reason) {
              return this.showToast('All escalation fields required', true)
            }
            payload.assignedTo = this.formData.assignedTo
            payload.escalatedToTeam = this.formData.escalatedToTeam
            payload.reason = this.formData.reason
            url = `${Const.BASE_URL}/helpDesk/escalateTicket`
            break

          case 'resolve':
            if (!this.formData.resolutionDetails) {
              return this.showToast('Resolution details required', true)
            }
            payload.resolutionDetails = this.formData.resolutionDetails
            url = `${Const.BASE_URL}/helpDesk/resolveTicket`
            break

          case 'close':
            url = `${Const.BASE_URL}/helpDesk/closeTicket`
            break

          case 'notes': {
            const formData = new FormData()
            formData.append('ticketID', this.formData.ticketID)
            formData.append('note', this.formData.note)
            if (this.formData.attachments) {
              formData.append('attachment', this.formData.attachments)
            }

            await axios.post(`${Const.BASE_URL}/ticketNotes/add`, formData, {
              headers: {
                'access-token': localStorage.getItem('accessToken'),
                'Content-Type': 'multipart/form-data'
              }
            })

            this.$emit('ticket-Assigned')
            return
          }

          default:
            return this.showToast('Invalid action selected', true)
        }

        const res = await axios.post(url, payload, {
          headers: { 'access-token': localStorage.getItem('accessToken') }
        })

        if (res.data?.status === 200) {
          this.$emit('ticket-Assigned', res.data.ticket)
        } else {
          this.showToast(res.data?.message || 'Failed', true)
        }

      } catch (error) {
        this.showToast(error.response?.data?.message || 'Failed', true)
      } finally {
        this.loading = false
      }
    },
  }
}
</script>

<template>
  <div>
    <form @submit.prevent="handleSubmit">
      <div class="modal-content">
        <div class="modal-header">
        <h5 class="modal-title">
          {{
            mode === 'assign' ? 'Assign Ticket' :
            mode === 'reassign' ? 'Reassign Ticket' :
            mode === 'escalate' ? 'Escalate Ticket' :
            mode === 'notes' ? 'Add Note' :
            mode === 'resolve' ? 'Resolve Ticket' :
            'Close Ticket'
          }}
        </h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>

        <div class="modal-body">
          <div class="row">
            <!-- Ticket Info -->
            <div class="col-md-6 mb-3">
              <label class="form-label">Ticket Number</label>
              <input type="text" class="form-control" :value="ticket.ticketNumber || ''" disabled />
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label">Issue Type</label>
              <input type="text" class="form-control" :value="ticket.issueType || ''" disabled />
            </div>
            <div class="col-md-12 mb-3">
              <label class="form-label">Title</label>
              <input type="text" class="form-control" :value="ticket.title || ''" disabled />
            </div>

            <!-- Assign/Reassign Fields -->
            <div class="col-md-6 mb-3" v-if="mode === 'assign' || mode === 'reassign'">
              <label for="assignedTo" class="form-label">Assign To</label>
              <select
                id="assignedTo"
                class="form-select"
                v-model="formData.assignedTo"
                :disabled="loadingUsers || loading"
                required
              >
                <option value="">{{ loadingUsers ? 'Loading users...' : 'Select user' }}</option>
                <option v-for="user in users" :key="user.userID" :value="user.userID">{{ user.name }}</option>
              </select>
            </div>

            <div class="col-md-6 mb-3" v-if="mode === 'assign'">
              <label for="priority" class="form-label">Priority</label>
              <select id="priority" class="form-select" v-model="formData.priority" :disabled="loading" required>
                <option value="">Select Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div class="col-md-12 mb-3" v-if="mode === 'reassign'">
              <label class="form-label">Reason for Reassignment</label>
              <textarea
                class="form-control"
                v-model="formData.reason"
                placeholder="Enter reason for reassignment"
                :disabled="loading"
                required
              ></textarea>
            </div>

            <div v-if="mode === 'escalate'" class="col-md-6 mb-3">
              <label class="form-label">Escalate To Team</label>
              <select v-model="formData.escalatedToTeam" class="form-select">
                <option value="">Select Team</option>
                <option v-for="team in teams" :key="team" :value="team">{{ team }}</option>
              </select>
            </div>

            <div v-if="mode === 'escalate'" class="col-md-6 mb-3">
              <label class="form-label">Assign To</label>
              <select v-model="formData.assignedTo" class="form-select">
                <option value="">Select user</option>
                <option v-for="user in users" :key="user.userID" :value="user.userID">
                  {{ user.name }}
                </option>
              </select>
            </div>

            <div v-if="mode === 'escalate'" class="col-md-12 mb-3">
              <label class="form-label">Reason</label>
              <textarea class="form-control" v-model="formData.reason"></textarea>
            </div>

            <div v-if="mode === 'notes'" class="col-md-12 mb-3">
              <label class="form-label">Note</label>
              <textarea class="form-control" v-model="formData.note"></textarea>
            </div>

            <div v-if="mode === 'notes'" class="col-md-12 mb-3">
              <label class="form-label">Attachment</label>
              <input type="file" class="form-control" @change="e => formData.attachments = e.target.files[0]" />
            </div>

            <div v-if="mode === 'resolve'" class="col-md-12 mb-3">
              <label class="form-label">Resolution Details</label>
              <textarea class="form-control" v-model="formData.resolutionDetails"></textarea>
            </div>

            <div v-if="mode === 'close'" class="alert alert-info">
              Are you sure you want to close this ticket?
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn me-auto" data-bs-dismiss="modal" :disabled="loading">Close</button>
<button type="submit" class="btn btn-primary" :disabled="loading || loadingUsers">
  <span v-if="loading">
    {{
      mode === 'assign' ? 'Assigning...' :
      mode === 'reassign' ? 'Reassigning...' :
      mode === 'escalate' ? 'Escalating...' :
      mode === 'notes' ? 'Saving Note...' :
      mode === 'resolve' ? 'Resolving...' :
      'Closing...'
    }}
  </span>
  <span v-else>
    {{
      mode === 'assign' ? 'Assign Ticket' :
      mode === 'reassign' ? 'Reassign Ticket' :
      mode === 'escalate' ? 'Escalate Ticket' :
      mode === 'notes' ? 'Add Note' :
      mode === 'resolve' ? 'Resolve Ticket' :
      'Close Ticket'
    }}
  </span>
</button>
        </div>
      </div>
    </form>
  </div>
</template>