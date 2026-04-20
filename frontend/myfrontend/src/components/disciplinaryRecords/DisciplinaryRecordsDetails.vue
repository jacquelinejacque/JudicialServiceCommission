<script>
import axios from 'axios'
import Toastify from 'toastify-js'
import { Const } from '../../utils/constants'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import 'bootstrap-icons/font/bootstrap-icons.css'
import EditRecordForm from './EditRecordForm.vue'
import RecordActions from './RecordActions.vue'
import { Modal } from 'bootstrap'

export default {
  props: {
    recordID: {
      type: String,
      required: true
    }
  },

  data() {
    return {
      loading: false,
      record: null,
      selectedRecord: null,
      selectedAction: null,
      currentUser: JSON.parse(localStorage.getItem('user') || '{}'),
    }
  },

  computed: {
    isRegistrar() {
      return this.currentUser?.role?.toLowerCase() === 'registrar'
    },
    isLegalTeam() {
      return this.currentUser?.role?.toLowerCase() === 'legalteam'
    },
    isDirectorLegal() {
      return this.currentUser?.role?.toLowerCase() === 'directorlegal'
    }
  },

  mounted() {
    this.fetchRecordDetails()
  },

  components: {
    EditRecordForm,
    RecordActions
  },

  methods: {
    showToast(message, isDanger) {
      Toastify({
        text: message,
        style: {
          background: isDanger ? '#d63939' : '#2fb344'
        }
      }).showToast()
    },

    formatDate(dateString) {
      if (!dateString) return ''
      const date = new Date(dateString)
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      return `${day}/${month}/${year}`
    },

    async fetchRecordDetails() {
      this.loading = true
      try {
        const response = await axios.get(
          `${Const.BASE_URL}/disciplinaryRecords/details/${this.recordID}`,
          {
            headers: {
              'access-token': localStorage.getItem('accessToken')
            }
          }
        )

        if (response.data.status === 200) {
          this.record = response.data.record
        } else {
          this.showToast(response.data.message || 'Failed to fetch record details', true)
        }
      } catch (error) {
        console.error('Fetch record details error:', error)
        this.showToast('Failed to fetch record details', true)
      } finally {
        this.loading = false
      }
    },
    async downloadReport(record) {
      try {
        const fileUrl = `${Const.BASE_URL}/disciplinaryRecords/file/${record.recordID}`

        const response = await axios.get(fileUrl, {
          responseType: 'blob',
          headers: {
            'access-token': localStorage.getItem('accessToken')
          }
        })

        const url = window.URL.createObjectURL(response.data)

        let fileName = `${record.title || 'Report'}_Report`

        const disposition = response.headers['content-disposition']
        if (disposition) {
          const utf8Match = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)
          const normalMatch =
            disposition.match(/filename\s*=\s*"([^"]+)"/i) ||
            disposition.match(/filename\s*=\s*([^;]+)/i)

          if (utf8Match && utf8Match[1]) {
            fileName = decodeURIComponent(utf8Match[1].trim())
          } else if (normalMatch && normalMatch[1]) {
            fileName = normalMatch[1].trim().replace(/^"|"$/g, '')
          }
        }

        const link = document.createElement('a')
        link.href = url
        link.download = fileName

        document.body.appendChild(link)
        link.click()
        link.remove()

        window.URL.revokeObjectURL(url)

        this.showToast("Download started", false)

      } catch (error) {
        console.error("Download failed:", error)
        this.showToast("Failed to download report", true)
      }
    },
    async downloadCaseFile(record, fileType) {
      try {
        const fileUrl = `${Const.BASE_URL}/disciplinaryRecords/caseFile/${record.recordID}/${fileType}`

        const response = await axios.get(fileUrl, {
          responseType: 'blob',
          headers: {
            'access-token': localStorage.getItem('accessToken')
          }
        })

        const url = window.URL.createObjectURL(response.data)

        let fileName = `${record.title || 'Case_File'}_${record.fileNumber || 'NoFileNumber'}_${fileType}`

        const disposition = response.headers['content-disposition']
        if (disposition) {
          const utf8Match = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)
          const normalMatch =
            disposition.match(/filename\s*=\s*"([^"]+)"/i) ||
            disposition.match(/filename\s*=\s*([^;]+)/i)

          if (utf8Match && utf8Match[1]) {
            fileName = decodeURIComponent(utf8Match[1].trim())
          } else if (normalMatch && normalMatch[1]) {
            fileName = normalMatch[1].trim().replace(/^"|"$/g, '')
          }
        }

        const link = document.createElement('a')
        link.href = url
        link.download = fileName

        document.body.appendChild(link)
        link.click()
        link.remove()

        window.URL.revokeObjectURL(url)

        this.showToast("Download started", false)
      } catch (error) {
        console.error("Download failed:", error)
        this.showToast("Failed to download file", true)
      }
    },
    async downloadPreliminaryReport(record) {
      try {
        const fileUrl = `${Const.BASE_URL}/disciplinaryRecords/preliminaryReport/${record.recordID}`

        const response = await axios.get(fileUrl, {
          responseType: 'blob',
          headers: {
            'access-token': localStorage.getItem('accessToken')
          }
        })

        const url = window.URL.createObjectURL(response.data)

        let fileName = `${record.title || 'Preliminary_Report'}_PreliminaryReport`

        const disposition = response.headers['content-disposition']
        if (disposition) {
          const utf8Match = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)
          const normalMatch =
            disposition.match(/filename\s*=\s*"([^"]+)"/i) ||
            disposition.match(/filename\s*=\s*([^;]+)/i)

          if (utf8Match && utf8Match[1]) {
            fileName = decodeURIComponent(utf8Match[1].trim())
          } else if (normalMatch && normalMatch[1]) {
            fileName = normalMatch[1].trim().replace(/^"|"$/g, '')
          }
        }

        const link = document.createElement('a')
        link.href = url
        link.download = fileName

        document.body.appendChild(link)
        link.click()
        link.remove()

        window.URL.revokeObjectURL(url)

        this.showToast("Download started", false)
      } catch (error) {
        console.error("Download failed:", error)
        this.showToast("Failed to download preliminary report", true)
      }
    },
    openEditModal(record) {
      this.selectedRecord = {
        ...record,
        recordID: record.recordID || record.recordId
      }

      this.$nextTick(() => {
        const modalEl = document.getElementById('editRecordModal')
        const modal = Modal.getInstance(modalEl) || new Modal(modalEl)
        modal.show()
      })
    },
    handleRecordEditing() {
      const modalEl = document.getElementById('editRecordModal')
      const modal = Modal.getInstance(modalEl)

      if (modal) {
        modal.hide()
      }

      this.fetchRecordDetails()
    },
    openActionModal(record, action) {
      this.selectedRecord = {
        ...record,
        recordID: record.recordID || record.recordId
      }
      this.selectedAction = action

      this.$nextTick(() => {
        const modalEl = document.getElementById('actionModal')
        const modal = Modal.getInstance(modalEl) || new Modal(modalEl)
        modal.show()
      })
    },

    handleActionCompleted() {
      const modalEl = document.getElementById('actionModal')
      const modal = Modal.getInstance(modalEl)

      if (modal) {
        modal.hide()
      }

      this.fetchRecordDetails()
    },
  }
}
</script>

<template>
  <div class="container-xxl py-4">
    <div class="card shadow-sm border-0">
      <div class="card-header bg-white d-flex align-items-center gap-3 py-3">
        <div>
          <button
            class="btn btn-outline-secondary btn-sm d-flex align-items-center"
            @click="$router.back()"
          >
            <i class="bi bi-arrow-left"></i>
          </button>
        </div>

        <div>
          <h4 class="mb-1 fw-bold text-dark">Record Details</h4>
          <small class="text-muted">View full information for this record</small>
        </div>

        <div class="ms-auto d-flex align-items-center gap-2 flex-wrap">
          <button
            v-if="record && record.status === 'Received'"
            class="btn btn-warning btn-sm"
            @click="openEditModal(record)"
          >
            Edit Report
          </button>

          <button
            v-if="record && record.status === 'Received' && isRegistrar"
            class="btn btn-primary btn-sm"
            @click="openActionModal(record, 'ASSIGN_REPORT')"
          >
            Assign Report
          </button>

          <button
            v-if="record && record.status === 'Under_review' && isDirectorLegal"
            class="btn btn-success btn-sm"
            @click="openActionModal(record, 'REGISTER_CASE')"
          >
            Register Case
          </button>

          <button
            v-if="record && record.status === 'Registered' && isLegalTeam"
            class="btn btn-success btn-sm"
            @click="openActionModal(record, 'PROCESS_CASE')"
          >
            Process Case
          </button>

          <button
            v-if="record && record.status === 'Processed'"
            class="btn btn-success btn-sm"
            @click="openActionModal(record, 'PRELIMINARY_REVIEW')"
          >
            Preliminary Review
          </button>


          <button
            v-if="record && record.status === 'Preliminary_review_completed'"
            class="btn btn-success btn-sm"
            @click="openActionModal(record, 'REVIEW_PRELIMINARY_REPORT')"
          >
            Review Preliminary Report
          </button>

          <button
            v-if="record && record.reportFile"
            class="btn btn-outline-primary btn-sm"
            @click="downloadReport(record)"
          >
            View Submitted Report
          </button>


          <button
            v-if="record && (record.status === 'Admitted' || record.status === 'Adjourned')"
            class="btn btn-success btn-sm"
            @click="openActionModal(record, 'ADD_HEARING_DATE')"
          >
            Add Hearing Date
          </button>

          <button
            v-if="record && record.status === 'Hearing'"
            class="btn btn-success btn-sm"
            @click="openActionModal(record, 'ADJOURN_CASE')"
          >
            Adjourn Case
          </button>

          <button
            v-if="record && record.status === 'Hearing'"
            class="btn btn-success btn-sm"
            @click="openActionModal(record, 'JUDGMENT_RESERVED')"
          >
            Reserve Judgement
          </button>

          <button
            v-if="record && (record.status === 'Hearing' || record.status === 'Judgment Reserved')"
            class="btn btn-success btn-sm"
            @click="openActionModal(record, 'ADD_JUDGEMENT')"
          >
            Deliver Judgement
          </button>

          <button
            v-if="record && record.status === 'Judgment Delivered' "
            class="btn btn-success btn-sm"
            @click="openActionModal(record, 'CLOSE_CASE')"
          >
            Close Case
          </button>

          <div  v-if="record && (record.summaryFile || record.boardBriefFile)" class="dropdown">
            <button
              class="btn btn-outline-success btn-sm dropdown-toggle"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              View Case Files
            </button>
            <ul class="dropdown-menu dropdown-menu-end shadow-sm">
              <li>
                <a
                  href="#"
                  class="dropdown-item"
                  @click.prevent="downloadCaseFile(record, 'summary')"
                >
                  View Summary
                </a>
              </li>
              <li>
                <a
                  href="#"
                  class="dropdown-item"
                  @click.prevent="downloadCaseFile(record, 'boardBrief')"
                >
                  View Board Brief
                </a>
              </li>
            </ul>
          </div>

          <button
            v-if="record && record.status === 'submitted_to_JSC' && record.preliminaryReport"
            class="btn btn-outline-warning btn-sm"
            @click="downloadPreliminaryReport(record)"
          >
            View Preliminary Report
          </button>
        </div>
      </div>

      <div class="card-body p-4">
        <div v-if="loading" class="text-center py-5">
          <div class="spinner-border text-primary mb-3" role="status"></div>
          <div class="text-muted">Loading record details...</div>
        </div>

        <div v-else-if="record">
          <!-- Top summary section -->
          <div class="row mb-5">
            <!-- Left side -->
            <div class="col-md-6">
              <h5 class="fw-bold mb-3 text-dark">Record Information</h5>
              <p class="mb-1"><strong>Received By:</strong> {{ record.receivedBy || '-' }}</p>
              <p class="mb-1"><strong>Received Date:</strong> {{ formatDate(record.receivedDate) }}</p>
              <p class="mb-1"><strong>Status:</strong> {{ record.status || '-' }}</p>
            </div>

            <!-- Right side -->
            <div class="col-md-6 text-md-end mt-4 mt-md-0">
              <h5 class="fw-bold mb-3 text-dark">Complainant Information</h5>
              <p class="mb-1"><strong>Complainant Name:</strong> {{ record.complainantName || '-' }}</p>
              <p class="mb-1"><strong>Source:</strong> {{ record.source || '-' }}</p>
            </div>
          </div>

          <!-- Title block -->
          <div class="mb-4">
            <h2 class="fw-bold text-dark mb-2">{{ record.title || 'Untitled Record' }}</h2>
            <p class="text-muted mb-0">Detailed view of the selected disciplinary record</p>
          </div>

          <hr class="my-4" />

          <!-- Details section -->
        <div class="rounded p-3 bg-light">
        <div class="row g-4">
        
            <div class="col-md-6">
            <label class="form-label fw-bold text-muted small mb-1">Record ID</label>
            <div class="fs-6 text-dark">{{ record.recordID || '-' }}</div>
            </div>

            <div class="col-md-6">
            <label class="form-label fw-bold text-muted small mb-1">Stage</label>
            <div class="fs-6 text-dark">{{ record.stage || '-' }}</div>
            </div>

            <div class="col-md-6">
            <label class="form-label fw-bold text-muted small mb-1">File Number</label>
            <div class="fs-6 text-dark">{{ record.fileNumber || '-' }}</div>
            </div>

            <div class="col-md-6">
            <label class="form-label fw-bold text-muted small mb-1">Officer Name</label>
            <div class="fs-6 text-dark">{{ record.officerName || '-' }}</div>
            </div>   

            <div class="col-md-6">
            <label class="form-label fw-bold text-muted small mb-1">Designation</label>
            <div class="fs-6 text-dark">{{ record.designation || '-' }}</div>
            </div>   

            <div class="col-md-6">
            <label class="form-label fw-bold text-muted small mb-1">Panel</label>
            <div class="fs-6 text-dark">{{ record.panel || '-' }}</div>
            </div>   

            <div class="col-md-6">
            <label class="form-label fw-bold text-muted small mb-1">PJ Number</label>
            <div class="fs-6 text-dark">{{ record.pjNumber || '-' }}</div>
            </div>  

            <div class="col-md-6">
            <label class="form-label fw-bold text-muted small mb-1">Case Against</label>
            <div class="fs-6 text-dark">{{ record.caseAgainst || '-' }}</div>
            </div> 
        </div>
        </div>

        </div>

        <div v-else class="text-center py-5 text-muted">
          No record details found.
        </div>
      </div>
    </div>
  </div>

    <!-- Edit Record modal -->
    <div
      class="modal fade"
      id="editRecordModal"
      tabindex="-1"
      aria-labelledby="editRecord"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-dialog-centered">
        <EditRecordForm v-if="selectedRecord" :record="selectedRecord" @record-Edited="handleRecordEditing" />
      </div>
    </div>

    <div class="modal fade" id="actionModal" tabindex="-1">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <RecordActions
          v-if="selectedRecord"
          :record="selectedRecord"
          :action="selectedAction"
          @action-completed="handleActionCompleted"
        />
      </div>
    </div>
</template>