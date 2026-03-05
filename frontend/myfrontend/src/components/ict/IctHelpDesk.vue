
<script>
import DataTable from 'datatables.net-vue3'
import { Const } from '../../utils/constants'
import DataTableBs5 from 'datatables.net-bs5'
import EditUserForm from './EditUserForm.vue'
import RaiseTicketForm from './RaiseTicketForm.vue'
import ResetPasswordForm from './ResetPasswordForm.vue'
import Toastify from 'toastify-js'
import axios from 'axios'
import { Modal } from 'bootstrap'
DataTable.use(DataTableBs5)

export default {
  components: {
    DataTable,
    RaiseTicketForm,
    EditUserForm,
    ResetPasswordForm
  },

  data() {
    return {
      selectedUserId: null,
      selectedUser: null,
      deleteFeedback: '',
      restoreFeedback: '',
      options: {
        responsive: true,
        serverSide: true,
        select: true,
        bLengthChange: false,
        bInfo: false,
        destroy: true,
        paging: true,
        searching: false,
        ordering: true,
        pageLength: 10,
        loading: false,
        ajax: {
          url: `${Const.BASE_URL}/users/list`,
          type: 'get',
          headers: {
            'access-token': localStorage.getItem('accessToken')
          },
          error: function () {
            console.log('Error loading data')
          }
        }
      },

      columns: [
        {
          title: 'Name',
          data: null,
          render: (data, type, row) => {
            return `${row.name}`
          }
        },
        {
          title: 'Phone',
          data: null,
          render: (data, type, row) => {
            return row.phone ? `${row.phone}` : 'null'
          }
        },
        {
          title: 'Email',
          data: null,
          render: (data, type, row) => {
            return row.email ? `${row.email}` : '_'
          }
        },
        {
          title: 'Role',
          data: null,
          render: (data, type, row) => {
            return `${row.role}`
          }
        },
        {
          title: 'status',
          data: null,
          render: (data, type, row) => {
            return `${row.status}`
          }
        },
        {
          data: null,
          render: '#action',
          title: 'Action'
        }
      ]
    }
  },

  mounted() {
    this.dt = this.$refs.table.dt
  },

  methods: {
    async getUsers() {
      this.dt = this.$refs.table.dt
      this.dt.ajax.reload(null, false)
    },

    showToast(message, isDanger) {
      Toastify({
        text: message,
        // className: className,
        style: {
          background: isDanger ? '#d63939' : '#2fb344'
        }
      }).showToast()
    },
    editUser(user) {
      this.selectedUser = { ...user }
      console.log(this.selectedUser)
    },

    setUserId(userId) {
      this.selectedUserId = userId
      console.log('Selected user Id:', this.selectedUserId)
    },

    handleTicket() {
      //console.log('ticket raised, closing modal and refreshing data...');
      const modal = document.getElementById('raiseTicketModal');
      if (modal) {
        const modalInstance = Modal.getInstance(modal) || new Modal(modal);
        modalInstance.hide();
        modal.addEventListener(
          'hidden.bs.modal',
          () => {
            document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
            document.body.classList.remove('modal-open'); 
          },
          { once: true }
        );
      }
      if (this.$refs.table && this.$refs.table.dt) {
        this.$refs.table.dt.ajax.reload(null, false);
      } else {
        console.error('DataTable reference is missing.');
      }
    },

    async deleteUser() {
      this.loading = true
      if (!this.selectedUserId) {
        this.showToast('User ID is missing', true)
        this.loading = false
        return
      }
      try {
        const res = await axios.post(
          `${Const.BASE_URL}/users/delete`,
          { userId: this.selectedUserId,
            feedback: this.deleteFeedback
           },
          { headers: { 'access-token': localStorage.getItem('accessToken') } }
        )
        console.log(res.data)
        this.loading = false
        if (res.data.status === 200) {
          this.showToast('User successfully deleted', false)
          const modal = document.getElementById('deleteUserModal')
          if (modal) {
            const modalInstance = Modal.getInstance(modal) || new Modal(modal)
            modalInstance.hide()

            modal.addEventListener(
              'hidden.bs.modal',
              () => {
                document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove())
                document.body.classList.remove('modal-open')
              },
              { once: true }
            )
          }
          this.getUsers()
        } else {
          const message = res.data.message || 'oops, something went wrong!'
          this.showToast(message, true)
        }
      } catch (error) {
        console.error('Error deleting the user:', error)
        this.showToast('Failed to delete user, please try again', true)
      } finally {
        this.loading = false
      }
    },
    async restoreUser() {
      this.loading = true
      if (!this.selectedUserId) {
        this.showToast('User ID is missing', true)
        this.loading = false
        return
      }
      try {
        const res = await axios.post(
          `${Const.BASE_URL}/users/reactivate`,
          { userId: this.selectedUserId,
            feedback: this.restoreFeedback
           },
          { headers: { 'access-token': localStorage.getItem('accessToken') } }
        )
        console.log(res.data)
        this.loading = false
        if (res.data.status === 200) {
          this.showToast('User successfully restored', false)
          const modal = document.getElementById('restoreUserModal')
          if (modal) {
            const modalInstance = Modal.getInstance(modal) || new Modal(modal)
            modalInstance.hide()

            modal.addEventListener(
              'hidden.bs.modal',
              () => {
                document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove())
                document.body.classList.remove('modal-open')
              },
              { once: true }
            )
          }
          this.getUsers()
        } else {
          const message = res.data.message || 'oops, something went wrong!'
          this.showToast(message, true)
        }
      } catch (error) {
        console.error('Error restoring the user:', error)
        this.showToast('Failed to restore user, please try again', true)
      } finally {
        this.loading = false
      }
    },
    async resetPassword() {
      this.loading = true
      if (!this.selectedUserId) {
        this.showToast('User ID is missing', true)
        this.loading = false
        return
      }
      try {
        const res = await axios.post(
          `${Const.BASE_URL}user/password/reset`,
          { selectedUserId: this.selectedUserId },
          { headers: { 'access-token': localStorage.getItem('accessToken') } }
        )
        this.loading = false
        if (res.data.status === 10001) {
          this.showToast('A new passsword has been sent to you via email', false)
          const modal = document.getElementById('updatePasswordModal')
          if (modal) {
            const modalInstance = Modal.getInstance(modal) || new Modal(modal)
            modalInstance.hide()

            modal.addEventListener(
              'hidden.bs.modal',
              () => {
                document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove())
                document.body.classList.remove('modal-open')
              },
              { once: true }
            )
          }
          this.getUsers()
        } else {
          const message = res.data.message || 'An error occred please try again later'
          this.showToast(message, true)
        }
      } catch (error) {
        console.error('Error occured while processing the request:', error)
        this.showToast('Failed to sent an email to user, please try again', true)
      } finally {
        this.loading = false
      }
    },

    handleUserEditing() {
      //console.log('User added, closing modal and refreshing data...');
      const modal = document.getElementById('editUserModal');
      if (modal) {
        const modalInstance = Modal.getInstance(modal) || new Modal(modal);
        modalInstance.hide();
        modal.addEventListener(
          'hidden.bs.modal',
          () => {
            document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
            document.body.classList.remove('modal-open'); 
          },
          { once: true }
        );
      }
      if (this.$refs.table && this.$refs.table.dt) {
        this.$refs.table.dt.ajax.reload(null, false);
      } else {
        console.error('DataTable reference is missing.');
      }
    },
  

  },
  props: []
}
</script>

<template>
  <div class="container-xxl py-3">

    <!-- Card -->
    <div class="card shadow-sm">

      <!-- Card header -->
      <div class="card-header d-flex align-items-center justify-content-between">
        <div>
          <h5 class="card-title mb-0">System Users</h5>
          <small class="text-muted">Manage users, roles and status</small>
        </div>

        <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#raiseTicketModal">
          Raise Ticket
        </button>
      </div>

      <!-- Card body -->
      <div class="card-body p-0">
        <div class="table-responsive">
          <DataTable
            ref="table"
            :columns="columns"
            :options="options"
            width="100%"
            class="table table-hover table-striped mb-0"
          >
            <template #action="props">
              <div class="d-flex gap-3 align-items-center">
                <a
                  href="#"
                  class="text-primary"
                  data-bs-toggle="modal"
                  data-bs-target="#editUserModal"
                  @click.prevent="editUser(props.rowData)"
                >
                  Edit
                </a>

                <a
                  href="#"
                  class="text-danger"
                  data-bs-toggle="modal"
                  data-bs-target="#resetPasswordModal"
                  @click.prevent="setUserId(props.rowData.userID)"
                >
                  Reset Password
                </a>

                <a
                  v-if="props.rowData.status === 'active'"
                  href="#"
                  class="text-muted"
                  data-bs-toggle="modal"
                  data-bs-target="#deleteUserModal"
                  @click.prevent="setUserId(props.rowData.userID)"
                >
                  <span class="btn-close" aria-label="Delete"></span>
                </a>

                <a
                  v-if="props.rowData.status === 'inactive'"
                  href="#"
                  class="text-success"
                  data-bs-toggle="modal"
                  data-bs-target="#restoreUserModal"
                  @click.prevent="setUserId(props.rowData.userID)"
                >
                  Restore
                </a>
              </div>
            </template>
          </DataTable>
        </div>
      </div>

    </div>

    <!-- Raise Ticket modal -->
    <div
      class="modal modal-blur fade"
      id="raiseTicketModal"
      tabindex="-1"
      aria-labelledby="raiseTicketModalLabel"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <RaiseTicketForm @ticket-Raised="handleTicket" />
      </div>
    </div>

    <!-- Edit user modal -->
    <div
      class="modal fade"
      id="editUserModal"
      tabindex="-1"
      aria-labelledby="editUser"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-dialog-centered">
        <EditUserForm v-if="selectedUser" :user="selectedUser" @user-Edited="handleUserEditing" />
      </div>
    </div>

    <!-- delete user modal -->
    <div
      class="modal fade"
      id="deleteUserModal"
      tabindex="-1"
      aria-labelledby="deleteUserModalLabel"
      aria-hidden="true"
      data-bs-backdrop="static"
      data-bs-keyboard="false"
    >
      <div class="modal-dialog modal-dialog-centered modal-md">
        <div class="modal-content">
          <div class="modal-body d-flex align-items-start justify-content-between">
            <div>
              <h5 class="modal-title mb-1">Delete User</h5>
              <div class="text-muted">Are you sure you want to delete this user?</div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn me-auto" data-bs-dismiss="modal">No</button>
            <button type="submit" class="btn btn-primary" @click="deleteUser" :disabled="loading">
              <span v-if="loading">removing...</span>
              <span v-else>Yes</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- restore user modal -->
    <div
      class="modal fade"
      id="restoreUserModal"
      tabindex="-1"
      aria-labelledby="restoreUserModalLabel"
      aria-hidden="true"
      data-bs-backdrop="static"
      data-bs-keyboard="false"
    >
      <div class="modal-dialog modal-dialog-centered modal-md">
        <div class="modal-content">
          <div class="modal-body d-flex align-items-start justify-content-between">
            <div>
              <h5 class="modal-title mb-1">Restore User</h5>
              <div class="text-muted">Are you sure you want to restore this user?</div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn me-auto" data-bs-dismiss="modal">No</button>
            <button type="submit" class="btn btn-primary" @click="restoreUser" :disabled="loading">
              <span v-if="loading">restoring...</span>
              <span v-else>Yes</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Password Reset modal -->
    <div
      class="modal fade"
      id="resetPasswordModal"
      tabindex="-1"
      aria-labelledby="resetPassword"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-dialog-centered">
        <ResetPasswordForm :userId="selectedUserId" />
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