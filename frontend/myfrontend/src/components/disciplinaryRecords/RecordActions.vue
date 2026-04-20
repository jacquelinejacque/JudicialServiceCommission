<script>
import { Const } from '@/utils/constants'
import axios from 'axios'
import Toastify from 'toastify-js'

export default {
  props: {
    record: { type: Object, required: true },
    action: { type: String, required: true }
  },

    data() {
        return {
            form: {
            officerName: "",
            designation: "",
            natureOfCharges: "",
            pjNumber: "",
            dateEscalated: "",
            caseAgainst: "",
            assignedTo: "",
            decision: "",
            panel: "",
            reviewNote: "",

            },
            actionPayload: {
                hearingDate: "",
                reason: "",
                note: "",
                judgement: ""
            },
            loading: false,  
            legalTeamUsers: [],
            loadingUsers: false
        }
    },

  computed: {
    title() {
      return (this.action || '').replaceAll('_', ' ')
    },

    endpoint() {
    switch (this.action) {
        case 'ASSIGN_REPORT':
        return `${Const.BASE_URL}/disciplinaryRecords/assignToDirectorLegal`

        case 'REGISTER_CASE':
        return `${Const.BASE_URL}/disciplinaryRecords/registerCase`

        case 'PROCESS_CASE':
        return `${Const.BASE_URL}/disciplinaryRecords/processCase`

        case 'PRELIMINARY_REVIEW':
        return `${Const.BASE_URL}/disciplinaryRecords/preliminaryReview`

        case 'REVIEW_PRELIMINARY_REPORT':
        return `${Const.BASE_URL}/disciplinaryRecords/reviewPreliminaryReport`

        case 'ADD_HEARING_DATE':
        case 'ADJOURN_CASE':
        case 'JUDGMENT_RESERVED':
        case 'ADD_JUDGEMENT':
        case 'CLOSE_CASE':
        return `${Const.BASE_URL}/disciplinaryRecords/update-action`

        default:
        return ''
    }
    }
  },
    mounted() {
        this.fetchLegalTeamUsers();
    },
    watch: {
        action() {
        this.actionPayload = {
            hearingDate: "",
            reason: "",
            note: "",
            judgement: ""
        }
      },
      'form.decision'(value) {
        if (value !== 'admit') {
          this.form.panel = ""
        }
      }
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

    handleFile(e, field) {
      this.form[field] = e.target.files[0]
    },

    async fetchLegalTeamUsers() {
    try {
        this.loadingUsers = true

        const res = await axios.get(`${Const.BASE_URL}/users/list`, {
        params: {
            role: 'legalTeam',
        },
        headers: {
            'access-token': localStorage.getItem('accessToken')
        }
        })

        if (res.data?.status === 200) {
        this.legalTeamUsers = res.data.data || []
        } else {
        this.legalTeamUsers = []
        this.showToast(res.data?.message || 'Failed to load legal team users', true)
        }

    } catch (err) {
        console.error(err)
        this.showToast(
        err?.response?.data?.message || 'Failed to fetch legal team users',
        true
        )
        this.legalTeamUsers = []

    } finally {
        this.loadingUsers = false
    }
    },
    async submit() {
    try {
        this.loading = true

        const recordId = this.record?.recordID || this.record?.recordId

        if (!recordId) {
        this.showToast('Record ID is missing', true)
        return
        }

        // ✅ ASSIGN REPORT
        if (this.action === 'ASSIGN_REPORT') {
        const res = await axios.post(this.endpoint, {
            recordID: recordId
        }, {
            headers: {
            'access-token': localStorage.getItem('accessToken')
            }
        })

        return this.handleResponse(res)
        }

        // ✅ REGISTER CASE
        if (this.action === 'REGISTER_CASE') {
        const payload = {
            recordID: recordId,
            officerName: this.form.officerName,
            designation: this.form.designation,
            natureOfCharges: this.form.natureOfCharges,
            pjNumber: this.form.pjNumber,
            dateEscalated: this.form.dateEscalated,
            caseAgainst: this.form.caseAgainst,
            assignedTo: this.form.assignedTo
        }

        const res = await axios.post(this.endpoint, payload, {
            headers: {
            'access-token': localStorage.getItem('accessToken')
            }
        })

        return this.handleResponse(res)
        }

        // REVIEW PRELIMINARY REPORT
      if (this.action === 'REVIEW_PRELIMINARY_REPORT') {
        const payload = {
          recordID: recordId,
          decision: this.form.decision,
          reviewNote: this.form.reviewNote
        }

        if (this.form.decision === 'admit') {
          payload.panel = this.form.panel
        }

        const res = await axios.post(this.endpoint, payload, {
          headers: {
            'access-token': localStorage.getItem('accessToken'),
            'Content-Type': 'application/json'
          }
        })

        return this.handleResponse(res)
      }

      if (
        [
          'ADD_HEARING_DATE',
          'ADJOURN_CASE',
          'JUDGMENT_RESERVED',
          'ADD_JUDGEMENT',
          'CLOSE_CASE'
        ].includes(this.action)
      ) {

        let payload = {}

        if (this.action === 'ADD_HEARING_DATE') {
          payload = {
            hearingDate: this.actionPayload.hearingDate
          }
        }

        if (this.action === 'ADJOURN_CASE') {
          payload = {
            reason: this.actionPayload.reason
          }
        }

        if (this.action === 'JUDGMENT_RESERVED') {
          payload = {
            note: this.actionPayload.note
          }
        }

        if (this.action === 'ADD_JUDGEMENT') {
          payload = {
            judgement: this.actionPayload.judgement
          }
        }

        if (this.action === 'CLOSE_CASE') {
          payload = {}
        }

        const res = await axios.post(this.endpoint, {
          recordID: recordId,
          action: this.action,
          payload
        }, {
          headers: {
            'access-token': localStorage.getItem('accessToken')
          }
        })

        if (res.data?.status === 200) {
          this.showToast(res.data.message || 'Success', false)
          this.$emit('action-completed', res.data.record)
        } else {
          this.showToast(res.data?.message || 'Operation failed', true)
        }

        return
      }

        //  FILE UPLOADS (PROCESS + PRELIMINARY)
        const formData = new FormData()
        formData.append('recordID', recordId)

        if (this.action === 'PROCESS_CASE') {
        formData.append('summaryFile', this.form.summaryFile)
        formData.append('boardBriefFile', this.form.boardBriefFile)
        }

        if (this.action === 'PRELIMINARY_REVIEW') {
        formData.append('preliminaryReport', this.form.preliminaryReport)
        }

        const res = await axios.post(this.endpoint, formData, {
        headers: {
            'access-token': localStorage.getItem('accessToken'),
            'Content-Type': 'multipart/form-data'
        }
        })

        return this.handleResponse(res)

    } catch (err) {
        console.error(err)
        this.showToast(
        err?.response?.data?.message || 'Action failed',
        true
        )
    } finally {
        this.loading = false
    }
    },
    handleResponse(res) {
      const message = res?.data?.message || 'Operation completed'

      if (res?.data?.status === 200) {
        this.showToast(message, false)
        this.$emit('action-completed', res.data.record)
      } else {
        this.showToast(message, true)
      }
    }
  }
}
</script>
<template>
  <form @submit.prevent="submit">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">{{ title }}</h5>
        <button class="btn-close" data-bs-dismiss="modal"></button>
      </div>

      <div class="modal-body">
        <!-- ASSIGN -->
        <div v-if="action === 'ASSIGN_REPORT'">
          <p>Are you sure you want to assign this report?</p>
        </div>

        <!-- REGISTER CASE -->
        <div v-if="action === 'REGISTER_CASE'" class="row">

        <!-- Officer Name -->
        <div class="col-md-6 mb-3">
            <label class="form-label">Officer Name</label>
            <input v-model="form.officerName" class="form-control" required />
        </div>

        <!-- Designation -->
        <div class="col-md-6 mb-3">
            <label class="form-label">Designation</label>
            <input v-model="form.designation" class="form-control" required />
        </div>

        <!-- Nature of Charges -->
        <div class="col-md-6 mb-3">
            <label class="form-label">Nature of Charges</label>
            <input v-model="form.natureOfCharges" class="form-control" required />
        </div>

        <!-- PJ Number -->
        <div class="col-md-6 mb-3">
            <label class="form-label">PJ Number</label>
            <input v-model="form.pjNumber" class="form-control" />
        </div>

        <!-- Date Escalated -->
        <div class="col-md-6 mb-3">
            <label class="form-label">Date Escalated</label>
            <input type="date" v-model="form.dateEscalated" class="form-control" />
        </div>

        <!-- Case Against (Dropdown) -->
        <div class="col-md-6 mb-3">
            <label class="form-label">Case Against</label>
            <select v-model="form.caseAgainst" class="form-select">
            <option value="" disabled>Select Type</option>
            <option value="Judicial Staff">Judicial Staff</option>
            <option value="Judicial Officer">Judicial Officer</option>
            </select>
        </div>

        <!-- Assigned To (Dynamic dropdown) -->
        <div class="col-md-6 mb-3">
            <label class="form-label">Assigned To</label>
            <select v-model="form.assignedTo" class="form-select">
            <option value="" disabled>Select Legal Team Member</option>
            <option v-for="user in legalTeamUsers" :key="user.userID" :value="user.userID">
                {{ user.name }}
            </option>
            </select>
        </div>
        </div>

        <!-- PROCESS CASE -->
        <div v-if="action === 'PROCESS_CASE'">
          <label>Summary File</label>
          <input type="file" class="form-control mb-2" @change="e => handleFile(e, 'summaryFile')" required />

          <label>Board Brief File</label>
          <input type="file" class="form-control" @change="e => handleFile(e, 'boardBriefFile')" required />
        </div>

        <!-- PRELIMINARY REVIEW -->
        <div v-if="action === 'PRELIMINARY_REVIEW'">
        <label>Upload Preliminary Report</label>
        <input
            type="file"
            class="form-control"
            @change="e => handleFile(e, 'preliminaryReport')"
            required
        />
        </div>

        <!-- REVIEW PRELIMINARY REPORT -->
        <div v-if="action === 'REVIEW_PRELIMINARY_REPORT'" class="row">
          <div class="col-md-6 mb-3">
            <label class="form-label">Decision</label>
            <select v-model="form.decision" class="form-select" required>
              <option value="" disabled>Select decision</option>
              <option value="admit">Admit</option>
              <option value="terminate">Terminate</option>
            </select>
          </div>

          <div
            v-if="form.decision === 'admit'"
            class="col-md-6 mb-3"
          >
            <label class="form-label">Panel</label>
            <select v-model="form.panel" class="form-select" :required="form.decision === 'admit'">
              <option value="" disabled>Select panel</option>
              <option value="Panel_1">Panel 1</option>
              <option value="Panel_2">Panel 2</option>
              <option value="Panel_3">Panel 3</option>
              <option value="Panel_4">Panel 4</option>
              <option value="Panel_5">Panel 5</option>
              <option value="Panel_6">Panel 6</option>
              <option value="Panel_7">Panel 7</option>
            </select>
          </div>

          <div class="col-md-12 mb-3">
            <label class="form-label">Review Note</label>
            <textarea
              v-model="form.reviewNote"
              class="form-control"
              rows="4"
              placeholder="Enter review note"
              required
            ></textarea>
          </div>
        </div>

        <!-- ADD HEARING DATE -->
        <div v-if="action === 'ADD_HEARING_DATE'">
        <label class="form-label">Hearing Date</label>
        <input
            type="datetime-local"
            class="form-control"
            v-model="actionPayload.hearingDate"
            required
        />
        </div>

        <!-- ADJOURN CASE -->
        <div v-if="action === 'ADJOURN_CASE'">
        <p>Are you sure you want to adjourn this case?</p>
        <label class="form-label">Reason</label>
        <input
            type="text"
            class="form-control"
            v-model="actionPayload.reason"
            required
        />
        </div>

        <!-- RESERVE JUDGEMEN````````` -->
        <div v-if="action === 'JUDGMENT_RESERVED'">
        <p>Judgement will be reserved.</p>
        <label class="form-label">Note</label>
        <textarea
            class="form-control"
            v-model="actionPayload.note"
            rows="3"
        ></textarea>
        </div>

        <!-- ADD JUDGEMENT -->
        <div v-if="action === 'ADD_JUDGEMENT'">
        <label class="form-label">Judgement</label>
        <textarea
            class="form-control"
            rows="3"
            v-model="actionPayload.judgement"
            required
        ></textarea>
        </div>

        <!-- CLOSE CASE -->
        <div v-if="action === 'CLOSE_CASE'">
        <p>Are you sure you want to close this case?</p>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn" data-bs-dismiss="modal">Cancel</button>
        <button class="btn btn-primary" :disabled="loading">
          <span v-if="loading">Processing...</span>
          <span v-else>Submit</span>
        </button>
      </div>
    </div>
  </form>
</template>