<script>
import { Const } from '../../utils/constants'
import Toastify from 'toastify-js'

export default {
  data() {
    return {
      loading: false,
      notesLoading: false,
      ticket: null,
      ticketNotes: [],
      currentUser: JSON.parse(localStorage.getItem('user') || '{}')
    }
  },

  computed: {
    ticketID() {
      return this.$route.params.ticketID
    }
  },

  mounted() {
    this.loadTicketDetails()
  },

  methods: {
    showToast(message, isDanger = false) {
      Toastify({
        text: message,
        style: {
          background: isDanger ? '#d63939' : '#2fb344'
        }
      }).showToast()
    },

    async loadTicketDetails() {
      this.loading = true
      this.notesLoading = true

      try {
        const [ticketResponse, notesResponse] = await Promise.all([
          fetch(`${Const.BASE_URL}/helpDesk/list?ticketID=${this.ticketID}`, {
            method: 'GET',
            headers: {
              'access-token': localStorage.getItem('accessToken')
            }
          }),
          fetch(`${Const.BASE_URL}/ticketNotes/list/${this.ticketID}`, {
            method: 'GET',
            headers: {
              'access-token': localStorage.getItem('accessToken')
            }
          })
        ])

        const ticketResult = await ticketResponse.json()
        const notesResult = await notesResponse.json()

        if (!ticketResponse.ok || ticketResult.status !== 200) {
          throw new Error(ticketResult.message || 'Failed to fetch ticket details')
        }

        if (!notesResponse.ok || notesResult.status !== 200) {
          throw new Error(notesResult.message || 'Failed to fetch ticket notes')
        }

        this.ticket = ticketResult.tickets?.[0] || notesResult.ticket || null
        this.ticketNotes = notesResult.notes || []
      } catch (err) {
        console.error('Failed to fetch ticket details:', err)
        this.showToast(err.message || 'Failed to fetch ticket details', true)
      } finally {
        this.loading = false
        this.notesLoading = false
      }
    },

    getAttachmentUrl(path) {
      if (!path) return null
      if (path.startsWith('http://') || path.startsWith('https://')) return path
      return `${Const.BASE_URL}/${path}`
    },

    getFileName(path) {
      if (!path) return ''
      return path.split('/').pop()
    },

    getAuthorRole(note) {
      const role = note.author?.role
      if (role === 'admin') return 'Admin'
      if (role === 'agent') return 'Agent'
      return 'Support'
    },

    goBack() {
      this.$router.push({ name: 'ict-help-desk' })
    }
  }
}
</script>

<template>
  <div class="container-xxl py-3">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div>
        <h4 class="mb-1">Ticket Details</h4>
        <small class="text-muted">View ticket guidance, notes and attachments.</small>
      </div>

      <button class="btn btn-outline-secondary" @click="goBack">
        Back to Tickets
      </button>
    </div>

    <div v-if="loading" class="card shadow-sm">
      <div class="card-body text-muted">
        Loading ticket details...
      </div>
    </div>

    <template v-else-if="ticket">
      <div class="card shadow-sm mb-4">
        <div class="card-header">
          <h5 class="mb-0">Ticket {{ ticket.ticketNumber }}</h5>
          <small class="text-muted">{{ ticket.title }}</small>
        </div>

        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-6">
              <div class="border rounded p-3 h-100">
                <h6 class="mb-3">Ticket Details</h6>
                <p class="mb-2"><strong>Requester:</strong> {{ ticket.requester?.name || ticket.createdBy || '_' }}</p>
                <p class="mb-2"><strong>Email:</strong> {{ ticket.requester?.email || '_' }}</p>
                <p class="mb-2"><strong>Phone:</strong> {{ ticket.requester?.phone || '_' }}</p>
                <p class="mb-2"><strong>Issue Type:</strong> {{ ticket.issueType || '_' }}</p>
                <p class="mb-2"><strong>Status:</strong> {{ ticket.status || '_' }}</p>
                <p class="mb-2"><strong>Priority:</strong> {{ ticket.priority || '_' }}</p>
                <p class="mb-0"><strong>Assigned To:</strong> {{ ticket.agent?.name || '_' }}</p>
              </div>
            </div>

            <div class="col-md-6">
              <div class="border rounded p-3 h-100">
                <h6 class="mb-3">Problem Description</h6>
                <p class="mb-0">{{ ticket.description || 'No description provided.' }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card shadow-sm">
        <div class="card-header">
          <h5 class="mb-0">Guidance / Notes</h5>
        </div>

        <div class="card-body">
          <div v-if="notesLoading" class="text-muted">
            Loading notes...
          </div>

          <div v-else-if="!ticketNotes.length" class="text-muted">
            No notes have been added to this ticket yet.
          </div>

          <div v-else class="d-flex flex-column gap-3">
            <div
              v-for="note in ticketNotes"
              :key="note.noteID"
              class="border rounded p-3 bg-light"
            >
              <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                <div>
                  <strong>{{ note.author?.name || 'Support' }}</strong>
                  <span class="badge bg-success text-white ms-2">{{ getAuthorRole(note) }}</span>
                </div>
                <small class="text-muted">
                  {{ note.createdAt ? new Date(note.createdAt).toLocaleString() : '_' }}
                </small>
              </div>

              <p class="mb-2">{{ note.note || '_' }}</p>

              <div v-if="note.attachment || note.attachmentUrl">
                <a
                  :href="note.attachmentUrl || getAttachmentUrl(note.attachment)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn-sm btn-outline-secondary"
                >
                  View Attachment: {{ getFileName(note.attachmentUrl || note.attachment) }}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="card shadow-sm">
      <div class="card-body text-danger">
        Ticket not found.
      </div>
    </div>
  </div>
</template>