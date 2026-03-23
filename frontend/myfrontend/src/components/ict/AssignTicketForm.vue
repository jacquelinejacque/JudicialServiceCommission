<script>
import { Const } from '@/utils/constants'
import axios from 'axios'
import Toastify from 'toastify-js'

export default {
  props: {
    ticket: { type: Object, required: true },
    mode: { type: String, default: 'assign' } // 'assign' or 'reassign'
  },

  data() {
    return {
      users: [],
      formData: {
        ticketID: '',
        ticketNumber: '',
        assignedTo: '',
        priority: '',
        reason: '' // only used for reassign
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
            reason: '' // reset reason on ticket change
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
        if (!this.formData.assignedTo) {
          this.showToast('Please select a user', true)
          return
        }

        if (this.mode === 'reassign' && !this.formData.reason) {
          this.showToast('Please provide a reason for reassignment', true)
          return
        }

        if (!this.formData.priority && this.mode === 'assign') {
          this.showToast('Please select priority', true)
          return
        }

        this.loading = true

        const submitData = {
          ticketID: this.formData.ticketID,
          assignedTo: this.formData.assignedTo,
          priority: this.formData.priority
        }

        if (this.mode === 'reassign') {
          submitData.reason = this.formData.reason
        }

        const url =
          this.mode === 'reassign'
            ? `${Const.BASE_URL}/helpDesk/reassignTicket`
            : `${Const.BASE_URL}/helpDesk/assign`

        const res = await axios.post(url, submitData, {
          headers: { 'access-token': localStorage.getItem('accessToken') }
        })

        if (res.data?.status === 200) {
          this.showToast(
            this.mode === 'reassign' ? 'Ticket reassigned successfully' : 'Ticket assigned successfully'
          )
          this.$emit('ticket-Assigned', res.data.ticket)
        } else {
          this.showToast(res.data?.message || 'Failed', true)
        }
      } catch (error) {
        console.error('Submit error:', error)
        this.showToast(error.response?.data?.message || 'Failed', true)
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<template>
  <div>
    <form @submit.prevent="handleSubmit">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ mode === 'reassign' ? 'Reassign Ticket' : 'Assign Ticket' }}</h5>
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
            <div class="col-md-6 mb-3">
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
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn me-auto" data-bs-dismiss="modal" :disabled="loading">Close</button>
          <button type="submit" class="btn btn-primary" :disabled="loading || loadingUsers">
            <span v-if="loading">{{ mode === 'reassign' ? 'Reassigning...' : 'Assigning...' }}</span>
            <span v-else>{{ mode === 'reassign' ? 'Reassign Ticket' : 'Assign Ticket' }}</span>
          </button>
        </div>
      </div>
    </form>
  </div>
</template>