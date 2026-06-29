<script>
import DataTable from 'datatables.net-vue3'
import DataTableBs5 from 'datatables.net-bs5'
import Toastify from 'toastify-js'
import { Const } from '../../utils/constants'

DataTable.use(DataTableBs5)

export default {
  components: {
    DataTable
  },

  data() {
    return {
      currentUser: JSON.parse(localStorage.getItem('user') || '{}'),
      badgeNumberSearchTimeout: null,

      filters: {
        badgeNumber: '',
        status: '',
        receptionDeskID: ''
      },

      options: {
        responsive: true,
        serverSide: false,
        processing: true,
        select: true,
        bLengthChange: false,
        bInfo: false,
        destroy: true,
        paging: true,
        searching: false,
        ordering: true,
        pageLength: 10,
        order: [[5, 'DESC']],

        ajax: {
          url: `${Const.BASE_URL}/visitorBadges/list`,
          type: 'get',
          headers: {
            'access-token': localStorage.getItem('accessToken')
          },

          data: (d) => {
            d.badgeNumber = this.filters.badgeNumber
            d.status = this.filters.status
            d.receptionDeskID = this.filters.receptionDeskID
          },

          dataSrc: (json) => {
            if (json.status === 200) {
              return json.data || []
            }

            this.showToast(json.message || 'Failed to load badges', true)
            return []
          },

          error: () => {
            this.showToast('Error loading visitor badges', true)
          }
        }
      },

      columns: [
        { title: 'Badge Number', data: 'badgeNumber' },
        { title: 'Reception Desk ID', data: 'receptionDeskID' },
        {
          title: 'Status',
          data: 'status',
          render: (data) => {
            return `<span class="${this.getStatusClass(data)} fw-semibold text-capitalize">${data}</span>`
          }
        },
        {
          title: 'Current Visit ID',
          data: 'currentVisitID',
          render: (data) => data || ''
        },
        {
          title: 'Issued At',
          data: 'issuedAt',
          render: (data) => this.formatDateTime(data)
        },
        {
          title: 'Returned At',
          data: 'returnedAt',
          render: (data) => this.formatDateTime(data)
        },
        {
          title: 'Remarks',
          data: 'remarks',
          render: (data) => data || ''
        },
        {
          title: 'Created At',
          data: 'createdAt',
          render: (data) => this.formatDateTime(data)
        }
      ]
    }
  },

  mounted() {
    this.dt = this.$refs.table.dt
  },

  methods: {
    applyFilters() {
      if (this.$refs.table && this.$refs.table.dt) {
        this.$refs.table.dt.ajax.reload(null, true)
      }
    },

    handleBadgeNumberSearch() {
      clearTimeout(this.badgeNumberSearchTimeout)

      this.badgeNumberSearchTimeout = setTimeout(() => {
        this.applyFilters()
      }, 400)
    },

    clearFilters() {
      this.filters = {
        badgeNumber: '',
        status: '',
        receptionDeskID: ''
      }

      this.applyFilters()
    },

    getStatusClass(status) {
      switch (status) {
        case 'available':
          return 'text-success'

        case 'issued':
          return 'text-primary'

        case 'lost':
          return 'text-danger'

        case 'inactive':
          return 'text-secondary'

        default:
          return 'text-dark'
      }
    },

    formatDateTime(dateString) {
      if (!dateString) return ''

      const date = new Date(dateString)

      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')

      return `${day}/${month}/${year} ${hours}:${minutes}`
    },

    showToast(message, isDanger) {
      Toastify({
        text: message,
        style: {
          background: isDanger ? '#d63939' : '#2fb344'
        }
      }).showToast()
    }
  }
}
</script>

<template>
  <div class="container-fluid px-3 py-4">
    <div class="card shadow-sm">
      <div class="card-header d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
        <div class="d-flex flex-column">
          <h5 class="card-title mb-1">Visitor Badges</h5>
          <small class="text-muted">Manage visitor badge records and status</small>
        </div>
      </div>

      <div class="card-body border-bottom bg-light">
        <div class="row g-3 align-items-end">
          <div class="col-md-3">
            <label for="filterBadgeNumber" class="form-label">Badge Number</label>
            <input
              id="filterBadgeNumber"
              v-model="filters.badgeNumber"
              type="text"
              class="form-control"
              placeholder="Search by badge number"
              @input="handleBadgeNumberSearch"
            />
          </div>

          <div class="col-md-3">
            <label for="filterReceptionDeskID" class="form-label">Reception Desk ID</label>
            <input
              id="filterReceptionDeskID"
              v-model="filters.receptionDeskID"
              type="text"
              class="form-control"
              placeholder="Filter by reception desk ID"
              @input="applyFilters"
            />
          </div>

          <div class="col-md-3">
            <label for="filterStatus" class="form-label">Status</label>
            <select
              id="filterStatus"
              v-model="filters.status"
              class="form-select"
              @change="applyFilters"
            >
              <option value="">All Statuses</option>
              <option value="available">Available</option>
              <option value="issued">Issued</option>
              <option value="lost">Lost</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div class="col-md-3">
            <label class="form-label d-block">&nbsp;</label>
            <button class="btn btn-outline-secondary btn-sm" @click="clearFilters">
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <div class="card-body p-3">
        <div class="table-responsive">
          <DataTable
            ref="table"
            :columns="columns"
            :options="options"
            width="100%"
            class="table table-hover table-striped table-sm mb-0"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.button-container {
  display: flex;
  flex-direction: row;
  gap: 2em;
}
</style>